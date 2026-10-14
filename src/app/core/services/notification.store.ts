import { computed, DestroyRef, effect, inject, Injectable, signal, untracked } from '@angular/core';
import { firstValueFrom, Subscription } from 'rxjs';
import { NotificationCreatedEvent, NotificationItem, NotificationsReadEvent } from '../models/notification.models';
import { friendlyError } from '../../shared/utils/friendly-error';
import { AuthService } from './auth.service';
import { MeetingHubService } from './meeting-hub.service';
import { NotificationService } from './notification.service';

export type NotificationFilter = 'all' | 'unread';

/** Poll dự phòng khi kênh realtime không kết nối được. */
export const NOTIFICATION_POLL_MS = 60_000;
const PAGE_SIZE = 20;

// =====================================================
// NotificationStore — trạng thái chuông thông báo của người đang đăng nhập.
// - Số chưa đọc + danh sách phân trang cursor, lọc Tất cả/Chưa đọc.
// - Realtime qua MeetingHub (kênh theo user); mất kết nối → poll 60s.
// - Đổi tài khoản / đăng xuất → xóa sạch dữ liệu + đóng kết nối, để người
//   dùng sau trên cùng máy không thấy thông báo của người trước.
// =====================================================
@Injectable({ providedIn: 'root' })
export class NotificationStore {
    private readonly api = inject(NotificationService);
    private readonly hub = inject(MeetingHubService);
    private readonly auth = inject(AuthService);

    readonly items = signal<NotificationItem[]>([]);
    readonly unreadCount = signal(0);
    readonly filter = signal<NotificationFilter>('all');
    readonly nextCursor = signal<string | null>(null);
    readonly loading = signal(false);
    readonly loadingMore = signal(false);
    readonly error = signal<string | null>(null);
    /** Đã tải trang đầu cho bộ lọc hiện tại chưa (để mở panel không nháy skeleton). */
    readonly loaded = signal(false);
    readonly realtime = signal<'connected' | 'polling'>('polling');
    /** Thông báo vừa đến qua realtime — panel/toast dùng để báo. */
    readonly lastArrived = signal<NotificationItem | null>(null);
    /** Id thông báo mà đích đến đã không còn quyền xem. */
    readonly stale = signal<ReadonlySet<string>>(new Set());

    readonly hasMore = computed(() => this.nextCursor() !== null);
    readonly badge = computed(() => {
        const n = this.unreadCount();
        return n <= 0 ? '' : n > 99 ? '99+' : String(n);
    });

    private owner: string | null = null;
    private subs: Subscription[] = [];
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private listToken = 0;

    constructor() {
        // Theo dõi người đăng nhập: đổi user → khởi tạo lại; null → dọn sạch.
        effect(() => {
            const userName = this.auth.currentUser()?.userName ?? null;
            untracked(() => {
                if (userName === this.owner) return;
                this.teardown();
                this.owner = userName;
                if (userName) this.start();
            });
        });
        inject(DestroyRef).onDestroy(() => this.teardown());
    }

    private start(): void {
        this.subs.push(
            this.hub.notificationCreated.subscribe((e) => this.onCreated(e)),
            this.hub.notificationsRead.subscribe((e) => this.onRead(e)),
            this.hub.connectionState.subscribe((state) => {
                this.realtime.set(state === 'connected' ? 'connected' : 'polling');
                // Vừa kết nối lại: đồng bộ số đếm vì có thể đã lỡ sự kiện.
                if (state === 'connected') void this.refreshCount();
            })
        );
        this.pollTimer = setInterval(() => {
            if (this.realtime() === 'polling' && document.visibilityState === 'visible') void this.refreshCount();
        }, NOTIFICATION_POLL_MS);
        document.addEventListener('visibilitychange', this.onVisible);
        void this.refreshCount();
        this.hub.connectForUser().catch(() => this.realtime.set('polling'));
    }

    private teardown(): void {
        this.subs.forEach((s) => s.unsubscribe());
        this.subs = [];
        if (this.pollTimer) clearInterval(this.pollTimer);
        this.pollTimer = null;
        document.removeEventListener('visibilitychange', this.onVisible);
        this.listToken++;
        this.items.set([]);
        this.unreadCount.set(0);
        this.nextCursor.set(null);
        this.loaded.set(false);
        this.error.set(null);
        this.lastArrived.set(null);
        this.stale.set(new Set());
        if (this.owner) void this.hub.disconnectUser().catch(() => undefined);
    }

    private readonly onVisible = () => {
        if (document.visibilityState === 'visible') void this.refreshCount();
    };

    async refreshCount(): Promise<void> {
        const owner = this.owner;
        try {
            const count = await firstValueFrom(this.api.unreadCount());
            if (owner === this.owner) this.unreadCount.set(count);
        } catch {
            // giữ số cũ; lỗi đã hiện ở panel khi người dùng mở
        }
    }

    /** Tải trang đầu (mở panel / đổi bộ lọc / thử lại). */
    async load(filter: NotificationFilter = this.filter()): Promise<void> {
        const token = ++this.listToken;
        this.filter.set(filter);
        this.loading.set(true);
        this.error.set(null);
        try {
            const page = await firstValueFrom(this.api.list(filter, null, PAGE_SIZE));
            if (token !== this.listToken) return;
            this.items.set(page.items);
            this.nextCursor.set(page.nextCursor);
            this.unreadCount.set(page.unreadCount);
            this.loaded.set(true);
        } catch (err) {
            if (token === this.listToken) this.error.set(friendlyError(err, 'Không tải được thông báo.'));
        } finally {
            if (token === this.listToken) this.loading.set(false);
        }
    }

    async loadMore(): Promise<void> {
        const cursor = this.nextCursor();
        if (!cursor || this.loadingMore()) return;
        const token = this.listToken;
        this.loadingMore.set(true);
        try {
            const page = await firstValueFrom(this.api.list(this.filter(), cursor, PAGE_SIZE));
            if (token !== this.listToken) return;
            const known = new Set(this.items().map((i) => i.id));
            this.items.update((list) => [...list, ...page.items.filter((i) => !known.has(i.id))]);
            this.nextCursor.set(page.nextCursor);
            this.unreadCount.set(page.unreadCount);
        } catch (err) {
            this.error.set(friendlyError(err, 'Không tải thêm được thông báo.'));
        } finally {
            this.loadingMore.set(false);
        }
    }

    /** Đánh dấu đã đọc/chưa đọc — cập nhật ngay, lỗi thì hoàn tác. */
    async markRead(item: NotificationItem, isRead = true): Promise<void> {
        if (item.isRead === isRead) return;
        this.patch(item.id, { isRead });
        this.unreadCount.update((n) => Math.max(0, n + (isRead ? -1 : 1)));
        try {
            this.unreadCount.set(await firstValueFrom(this.api.markRead(item.id, isRead)));
        } catch (err) {
            this.patch(item.id, { isRead: !isRead });
            this.unreadCount.update((n) => Math.max(0, n + (isRead ? 1 : -1)));
            throw new Error(friendlyError(err, 'Không cập nhật được thông báo.'));
        }
    }

    async markAllRead(): Promise<void> {
        const before = this.items().map((i) => i.isRead);
        const prevCount = this.unreadCount();
        // Mốc = lúc người dùng bấm: thông báo đến sau đó vẫn chưa đọc.
        const cutoff = new Date().toISOString();
        this.items.update((list) => list.map((i) => ({ ...i, isRead: true })));
        this.unreadCount.set(0);
        try {
            this.unreadCount.set(await firstValueFrom(this.api.markAllRead(cutoff)));
            if (this.filter() === 'unread') this.items.set([]);
        } catch (err) {
            this.items.update((list) => list.map((i, idx) => ({ ...i, isRead: before[idx] ?? i.isRead })));
            this.unreadCount.set(prevCount);
            throw new Error(friendlyError(err, 'Không cập nhật được thông báo.'));
        }
    }

    async remove(item: NotificationItem): Promise<void> {
        const snapshot = this.items();
        this.items.update((list) => list.filter((i) => i.id !== item.id));
        if (!item.isRead) this.unreadCount.update((n) => Math.max(0, n - 1));
        try {
            await firstValueFrom(this.api.remove(item.id));
        } catch (err) {
            this.items.set(snapshot);
            if (!item.isRead) this.unreadCount.update((n) => n + 1);
            throw new Error(friendlyError(err, 'Không xóa được thông báo.'));
        }
    }

    markStale(id: string): void {
        this.stale.update((s) => new Set(s).add(id));
    }

    private onCreated(e: NotificationCreatedEvent): void {
        const n = e.notification;
        this.unreadCount.set(e.unreadCount);
        this.lastArrived.set(n);
        // BE gom nhóm theo DedupeKey: cùng id → đưa lên đầu thay vì thêm dòng mới.
        this.items.update((list) => [n, ...list.filter((i) => i.id !== n.id)]);
    }

    private onRead(e: NotificationsReadEvent): void {
        this.unreadCount.set(e.unreadCount);
        if (e.ids === null) {
            this.items.update((list) => list.map((i) => ({ ...i, isRead: true })));
            return;
        }
        const ids = new Set(e.ids);
        this.items.update((list) =>
            e.deleted ? list.filter((i) => !ids.has(i.id)) : list.map((i) => (ids.has(i.id) ? { ...i, isRead: e.isRead } : i))
        );
    }

    private patch(id: string, patch: Partial<NotificationItem>): void {
        this.items.update((list) => list.map((i) => (i.id === id ? { ...i, ...patch } : i)));
    }
}

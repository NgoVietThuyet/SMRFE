import { HttpErrorResponse } from '@angular/common/http';
import { AfterViewInit, Component, computed, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { firstValueFrom, Observable } from 'rxjs';
import { NotificationItem, NotificationSeverity } from '../../core/models/notification.models';
import { MeetingService } from '../../core/services/meeting.service';
import { NotificationFilter, NotificationStore } from '../../core/services/notification.store';
import { TaskService } from '../../core/services/task.service';
import { Avatar } from '../../shared/ui/avatar/avatar';
import { isToday, notificationIcon, notificationLink, shortDateTime, timeAgo } from '../../shared/utils/notification-link';

interface Group {
    label: string;
    items: NotificationItem[];
}

// =====================================================
// NotificationPanel — nội dung panel chuông (popover desktop / drawer mobile).
// Tabs Tất cả | Chưa đọc · nhóm Hôm nay / Trước đó · tải thêm.
// Bấm thông báo: đánh dấu đã đọc → kiểm tra còn quyền xem đích (L3)
// → điều hướng; mất quyền thì báo và gắn nhãn "Không còn truy cập".
// =====================================================
@Component({
    selector: 'app-notification-panel',
    templateUrl: './notification-panel.html',
    styleUrl: './notification-panel.scss',
    imports: [Avatar, NzButtonModule, NzDropdownModule, NzIconModule],
    host: {
        class: 'noti-panel',
        role: 'dialog',
        'aria-label': 'Thông báo',
        '[class.is-fullscreen]': 'fullscreen()',
        '(keydown.escape)': 'closed.emit()',
    },
})
export class NotificationPanel implements AfterViewInit {
    protected readonly store = inject(NotificationStore);
    private readonly router = inject(Router);
    private readonly message = inject(NzMessageService);
    private readonly taskService = inject(TaskService);
    private readonly meetingService = inject(MeetingService);

    /** Hiển thị trong drawer toàn màn hình (mobile). */
    readonly fullscreen = input(false);
    readonly closed = output<void>();

    protected readonly Severity = NotificationSeverity;
    private readonly firstTab = viewChild<ElementRef<HTMLButtonElement>>('firstTab');

    protected readonly groups = computed<Group[]>(() => {
        const today: NotificationItem[] = [];
        const earlier: NotificationItem[] = [];
        for (const n of this.store.items()) (isToday(n.createDate) ? today : earlier).push(n);
        return [
            { label: 'Hôm nay', items: today },
            { label: 'Trước đó', items: earlier },
        ].filter((g) => g.items.length > 0);
    });

    constructor() {
        // Mở panel: tải trang đầu nếu chưa có (hoặc làm mới khi đã có realtime đẩy thêm).
        if (!this.store.loaded() || this.store.error()) void this.store.load();
    }

    ngAfterViewInit(): void {
        setTimeout(() => this.firstTab()?.nativeElement.focus());
    }

    protected setFilter(filter: NotificationFilter): void {
        if (filter !== this.store.filter() || !this.store.loaded()) void this.store.load(filter);
    }

    protected async markAll(): Promise<void> {
        try {
            await this.store.markAllRead();
        } catch (err) {
            this.message.error((err as Error).message);
        }
    }

    protected async toggleRead(n: NotificationItem): Promise<void> {
        try {
            await this.store.markRead(n, !n.isRead);
        } catch (err) {
            this.message.error((err as Error).message);
        }
    }

    protected async remove(n: NotificationItem): Promise<void> {
        try {
            await this.store.remove(n);
        } catch (err) {
            this.message.error((err as Error).message);
        }
    }

    protected async open(n: NotificationItem, event?: Event): Promise<void> {
        const link = notificationLink(n);
        // Chuột giữa / Ctrl+click: để trình duyệt mở tab mới, chỉ đánh dấu đã đọc.
        if (event instanceof MouseEvent && (event.button === 1 || event.ctrlKey || event.metaKey)) {
            void this.store.markRead(n).catch(() => undefined);
            return;
        }
        event?.preventDefault();
        void this.store.markRead(n).catch(() => undefined);
        if (!link) return;
        if (!(await this.canStillView(n))) {
            this.store.markStale(n.id);
            this.message.warning('Bạn không còn quyền xem nội dung này hoặc nội dung đã bị xóa.');
            return;
        }
        this.closed.emit();
        void this.router.navigate(link);
    }

    /** L3: đích có thể đã bị xóa hoặc người dùng đã mất quyền sau khi nhận thông báo. */
    private async canStillView(n: NotificationItem): Promise<boolean> {
        if (!n.resourceId) return false;
        const check: Observable<unknown> | null =
            n.resourceType === 'meeting'
                ? this.meetingService.getDetail(n.resourceId)
                : n.resourceType === 'task'
                  ? this.taskService.get(n.resourceId)
                  : null;
        if (!check) return true;
        try {
            await firstValueFrom(check);
            return true;
        } catch (err) {
            const status = err instanceof HttpErrorResponse ? err.status : 0;
            const msg = err instanceof Error ? err.message : '';
            if (status === 403 || status === 404 || /quyền|không tìm thấy|không tồn tại/i.test(msg)) return false;
            return true; // lỗi mạng: để trang đích tự hiện trạng thái lỗi
        }
    }

    protected href(n: NotificationItem): string | null {
        const link = notificationLink(n);
        return link ? this.router.serializeUrl(this.router.createUrlTree(link)) : null;
    }

    protected icon(n: NotificationItem): string {
        return notificationIcon(n.type);
    }

    protected ago(n: NotificationItem): string {
        return timeAgo(n.createDate);
    }

    /** Dòng phụ: giờ họp / lý do hủy / tên bảng. */
    protected detail(n: NotificationItem): string {
        const d = n.data;
        if (!d) return '';
        if (n.type === 'MEETING_CANCELLED' && d.reason) return `Lý do: ${d.reason}`;
        if (n.type.startsWith('MEETING_') && d.startTime) return `Bắt đầu ${shortDateTime(d.startTime)}`;
        if (n.type.startsWith('TASK_') && d.workTitle && d.level) return `Trong “${d.workTitle}”`;
        return '';
    }
}

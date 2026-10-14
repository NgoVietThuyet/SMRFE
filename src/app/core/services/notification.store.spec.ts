import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { NotificationCreatedEvent, NotificationItem, NotificationsReadEvent } from '../models/notification.models';
import { AuthService } from './auth.service';
import { MeetingHubService } from './meeting-hub.service';
import { NotificationService } from './notification.service';
import { NotificationStore } from './notification.store';

function item(patch: Partial<NotificationItem> = {}): NotificationItem {
    return {
        id: 'n1',
        type: 'TASK_ASSIGNED',
        severity: 0,
        title: 'An giao cho bạn một việc nhỏ',
        body: 'Viết retry',
        resourceType: 'task',
        resourceId: 't1',
        meetingId: null,
        actorUserName: 'an',
        actorFullName: 'An',
        data: { level: 2, workId: 'w1' },
        isRead: false,
        createDate: new Date().toISOString(),
        ...patch,
    };
}

describe('NotificationStore', () => {
    let store: NotificationStore;
    const user = signal<{ userName: string } | null>({ userName: 'b' });
    let hub: {
        notificationCreated: Subject<NotificationCreatedEvent>;
        notificationsRead: Subject<NotificationsReadEvent>;
        connectionState: BehaviorSubject<string>;
        connected: number;
        disconnected: number;
        connectForUser: () => Promise<void>;
        disconnectUser: () => Promise<void>;
    };
    let markReadFails: boolean;
    let unread: number;

    beforeEach(() => {
        user.set({ userName: 'b' });
        markReadFails = false;
        unread = 2;
        hub = {
            notificationCreated: new Subject(),
            notificationsRead: new Subject(),
            connectionState: new BehaviorSubject('connected'),
            connected: 0,
            disconnected: 0,
            connectForUser: async () => void hub.connected++,
            disconnectUser: async () => void hub.disconnected++,
        };
        TestBed.configureTestingModule({
            providers: [
                { provide: AuthService, useValue: { currentUser: user } },
                { provide: MeetingHubService, useValue: hub },
                {
                    provide: NotificationService,
                    useValue: {
                        unreadCount: () => of(unread),
                        list: () => of({ items: [item(), item({ id: 'n2', isRead: true })], nextCursor: 'c1', unreadCount: unread }),
                        markRead: (_id: string, isRead: boolean) =>
                            markReadFails ? throwError(() => new Error('Lỗi')) : of(isRead ? unread - 1 : unread + 1),
                        markAllRead: () => of(0),
                        remove: () => of(undefined),
                    },
                },
            ],
        });
        store = TestBed.inject(NotificationStore);
        TestBed.tick();
    });

    it('khởi tạo: lấy số chưa đọc và mở kênh realtime theo user', async () => {
        await Promise.resolve();
        expect(store.unreadCount()).toBe(2);
        expect(hub.connected).toBe(1);
        expect(store.badge()).toBe('2');
    });

    it('thông báo realtime mới lên đầu danh sách; cùng id (gom nhóm) không bị nhân đôi', async () => {
        await store.load();
        hub.notificationCreated.next({ eventId: 'e1', occurredAt: '', notification: item({ id: 'n9', title: 'Mới' }), unreadCount: 3 });
        hub.notificationCreated.next({ eventId: 'e2', occurredAt: '', notification: item({ id: 'n9', title: 'Mới hơn' }), unreadCount: 3 });
        expect(store.items().map((i) => i.id)).toEqual(['n9', 'n1', 'n2']);
        expect(store.items()[0].title).toBe('Mới hơn');
        expect(store.unreadCount()).toBe(3);
        expect(store.lastArrived()?.id).toBe('n9');
    });

    it('đánh dấu đã đọc cập nhật ngay; lỗi thì hoàn tác', async () => {
        await store.load();
        await store.markRead(store.items()[0]);
        expect(store.items()[0].isRead).toBe(true);
        expect(store.unreadCount()).toBe(1);

        markReadFails = true;
        await expect(store.markRead(store.items()[0], false)).rejects.toThrow();
        expect(store.items()[0].isRead).toBe(true);
        expect(store.unreadCount()).toBe(1);
    });

    it('đồng bộ từ tab khác: đọc tất cả / xóa', async () => {
        await store.load();
        hub.notificationsRead.next({ ids: null, isRead: true, deleted: false, unreadCount: 0 });
        expect(store.items().every((i) => i.isRead)).toBe(true);
        hub.notificationsRead.next({ ids: ['n2'], isRead: true, deleted: true, unreadCount: 0 });
        expect(store.items().map((i) => i.id)).toEqual(['n1']);
    });

    it('đổi tài khoản: xóa sạch dữ liệu người trước và kết nối lại', async () => {
        await store.load();
        expect(store.items().length).toBe(2);

        user.set(null);
        TestBed.tick();
        expect(store.items()).toEqual([]);
        expect(store.unreadCount()).toBe(0);
        expect(hub.disconnected).toBe(1);

        user.set({ userName: 'd' });
        TestBed.tick();
        expect(hub.connected).toBe(2);
    });

    it('mất realtime thì chuyển sang chế độ poll', () => {
        hub.connectionState.next('disconnected');
        expect(store.realtime()).toBe('polling');
        hub.connectionState.next('connected');
        expect(store.realtime()).toBe('connected');
    });
});

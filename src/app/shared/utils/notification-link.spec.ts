import { NotificationItem } from '../../core/models/notification.models';
import { notificationLink, timeAgo } from './notification-link';

function n(patch: Partial<NotificationItem>): NotificationItem {
    return {
        id: 'x',
        type: 'TASK_ASSIGNED',
        severity: 0,
        title: '',
        body: null,
        resourceType: 'task',
        resourceId: 'r1',
        meetingId: null,
        actorUserName: null,
        actorFullName: null,
        data: null,
        isRead: false,
        createDate: '2026-10-08T01:00:00Z',
        ...patch,
    };
}

describe('notificationLink', () => {
    it('cuộc họp → trang chi tiết', () => {
        expect(notificationLink(n({ type: 'MEETING_INVITED', resourceType: 'meeting', resourceId: 'm1' }))).toEqual(['/meetings', 'm1']);
    });

    it('việc nhỏ → drawer thẻ trên bảng gốc', () => {
        expect(notificationLink(n({ resourceId: 's1', data: { level: 2, workId: 'w1' } }))).toEqual(['/tasks', 'w1', 'cards', 's1']);
    });

    it('đầu việc → bảng gốc; công việc → chính bảng đó', () => {
        expect(notificationLink(n({ resourceId: 'l1', data: { level: 1, workId: 'w1' } }))).toEqual(['/tasks', 'w1']);
        expect(notificationLink(n({ resourceId: 'w1', data: { level: 0, workId: 'w1' } }))).toEqual(['/tasks', 'w1']);
    });

    it('bị xóa khỏi cuộc họp → không có link', () => {
        expect(notificationLink(n({ type: 'MEETING_REMOVED', resourceType: 'none', resourceId: null }))).toBeNull();
    });
});

describe('timeAgo', () => {
    const now = new Date('2026-10-08T10:00:00').getTime();
    it('định dạng tương đối', () => {
        expect(timeAgo(new Date(now - 20_000).toISOString(), now)).toBe('Vừa xong');
        expect(timeAgo(new Date(now - 5 * 60_000).toISOString(), now)).toBe('5 phút trước');
        expect(timeAgo(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe('3 giờ trước');
        expect(timeAgo(new Date(now - 26 * 3_600_000).toISOString(), now)).toBe('Hôm qua');
    });
});

import { NotificationItem } from '../../core/models/notification.models';

/**
 * Route đích của một thông báo, hoặc null khi không có đích (ví dụ bị xóa khỏi cuộc họp).
 * Task: công việc (0) và đầu việc (1) mở bảng; việc nhỏ (2) mở thẳng drawer chi tiết trên bảng.
 */
export function notificationLink(n: NotificationItem): string[] | null {
    if (!n.resourceId) return null;
    if (n.resourceType === 'meeting') return ['/meetings', n.resourceId];
    if (n.resourceType === 'task') {
        const level = n.data?.level ?? 0;
        const workId = n.data?.workId ?? n.resourceId;
        if (level === 2) return ['/tasks', workId, 'cards', n.resourceId];
        return ['/tasks', workId];
    }
    return null;
}

/** Icon ng-zorro theo loại thông báo (đã đăng ký trong app.config). */
export function notificationIcon(type: string): string {
    if (type === 'MEETING_CANCELLED' || type === 'MEETING_REMOVED') return 'warning';
    if (type === 'MEETING_STARTED') return 'video-camera';
    if (type.startsWith('MEETING_')) return 'calendar';
    if (type === 'TASK_COMPLETED') return 'check-circle';
    return 'check-square';
}

/** "Vừa xong", "5 phút trước", "3 giờ trước", "Hôm qua", "07/10". */
export function timeAgo(iso: string, now = Date.now()): string {
    const t = new Date(iso).getTime();
    const diff = Math.max(0, now - t);
    const min = Math.floor(diff / 60_000);
    if (min < 1) return 'Vừa xong';
    if (min < 60) return `${min} phút trước`;
    const hours = Math.floor(min / 60);
    if (hours < 24 && isSameDay(t, now)) return `${hours} giờ trước`;
    if (isSameDay(t, now - 86_400_000)) return 'Hôm qua';
    const d = new Date(t);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    return d.getFullYear() === new Date(now).getFullYear() ? `${day}/${month}` : `${day}/${month}/${d.getFullYear()}`;
}

/** "14:00 09/10" — giờ địa phương của trình duyệt. */
export function shortDateTime(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function isToday(iso: string, now = Date.now()): boolean {
    return isSameDay(new Date(iso).getTime(), now);
}

function isSameDay(a: number, b: number): boolean {
    return new Date(a).toDateString() === new Date(b).toDateString();
}

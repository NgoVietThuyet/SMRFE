/** Loại thông báo do BE-Java phát (NotificationDispatcher). */
export type NotificationType =
    | 'MEETING_INVITED'
    | 'MEETING_RESCHEDULED'
    | 'MEETING_CANCELLED'
    | 'MEETING_STARTED'
    | 'MEETING_REMOVED'
    | 'TASK_ASSIGNED'
    | 'TASK_STATUS_CHANGED'
    | 'TASK_SHARED'
    | 'TASK_COMPLETED'
    | 'MINUTES_READY'
    | 'MINUTES_PUBLISHED'
    | 'MINUTES_EXPORT_READY';

/** 0 Thông tin · 1 Cảnh báo · 2 Lỗi · 3 Cần xác nhận */
export enum NotificationSeverity {
    Info = 0,
    Warning = 1,
    Error = 2,
    Confirm = 3,
}

/** NotificationItemResponse — GET /api/Notification. */
export interface NotificationItem {
    id: string;
    type: NotificationType | string;
    severity: NotificationSeverity;
    title: string;
    body: string | null;
    resourceType: 'meeting' | 'task' | 'none' | string;
    resourceId: string | null;
    meetingId: string | null;
    actorUserName: string | null;
    actorFullName: string | null;
    data: Record<string, any> | null;
    isRead: boolean;
    createDate: string;
}

/** Trang thông báo phân trang theo cursor; nextCursor = null khi hết. */
export interface NotificationPage {
    items: NotificationItem[];
    nextCursor: string | null;
    unreadCount: number;
}

/** Sự kiện realtime /meetinghub — kênh theo người dùng. */
export interface NotificationCreatedEvent {
    eventId: string;
    occurredAt: string;
    notification: NotificationItem;
    unreadCount: number;
}

export interface NotificationsReadEvent {
    ids: string[] | null;
    isRead: boolean;
    deleted: boolean;
    unreadCount: number;
}

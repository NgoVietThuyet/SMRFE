// Khớp BE dto/nt (NotificationController /api/Notification).

export type NotificationType =
    | 'MEETING_INVITED'
    | 'MEETING_RESCHEDULED'
    | 'MEETING_CANCELLED'
    | 'MEETING_STARTED'
    | 'MEETING_REMOVED'
    | 'TASK_ASSIGNED'
    | 'TASK_STATUS_CHANGED'
    | 'TASK_SHARED'
    | 'TASK_COMPLETED';

// 0 Thông tin · 1 Cảnh báo · 2 Lỗi · 3 Cần xác nhận
export enum NotificationSeverity {
    Info = 0,
    Warning = 1,
    Error = 2,
    Confirm = 3,
}

// DataJson do BE ghi (schemaVersion 1) — chỉ chứa field hiển thị/dựng link.
export interface NotificationData {
    schemaVersion?: number;
    meetingName?: string;
    startTime?: string | null;
    endTime?: string | null;
    reason?: string;
    level?: number;
    parentId?: string | null;
    workId?: string;
    workTitle?: string | null;
    status?: number;
}

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
    data: NotificationData | null;
    isRead: boolean;
    createDate: string; // ISO UTC có 'Z'
}

export interface NotificationPage {
    items: NotificationItem[];
    nextCursor: string | null;
    unreadCount: number;
}

export interface UnreadCount {
    unreadCount: number;
}

// Realtime /meetinghub — kênh theo người dùng
export interface NotificationCreatedEvent {
    eventId: string;
    occurredAt: string;
    notification: NotificationItem;
    unreadCount: number;
}

export interface NotificationsReadEvent {
    ids: string[] | null; // null = tất cả
    isRead: boolean;
    deleted: boolean;
    unreadCount: number;
}

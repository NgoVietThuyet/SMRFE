/**
 * Model trang Tổng quan (P8) — khớp DTO BE-Java.
 * Model cuộc họp dùng chung nằm ở features/meeting/models (P9) — re-export lại để code P8 không đổi import.
 * Model công việc nằm ở features/task/models (P12) — re-export để code P8 không đổi import.
 * Mọi thời gian BE trả về là LocalDateTime theo UTC (không kèm 'Z') → đọc bằng DateTimeUtils.fromUtc().
 */
import { MeetingListItem } from '../../meeting/models/meeting.models';
export { MeetingStatus } from '../../meeting/models/meeting.models';
export type { MeetingListItem, MeetingQuery, UserSearchItem } from '../../meeting/models/meeting.models';
export { TaskStatus } from '../../task/models/task.models';
export type { TaskListItem, TaskSearchResult } from '../../task/models/task.models';

/** MeetingDashboardResponse — GET /api/Meeting/dashboard. */
export interface MeetingDashboard {
    upcoming: number;
    ongoing: number;
    ended: number;
    cancelled: number;
    nextMeetings: MeetingListItem[];
}

/** TaskSearchRequest — POST /api/Task/query. */
export interface TaskQuery {
    shortcut: 'all' | 'mine' | 'today' | 'overdue';
    keyword: string;
    assignee: string | null;
    page: number;
    pageSize: number;
}

/** MeetingCodeLookupResponse — GET /api/Meeting/by-code/{roomCode}. */
export interface MeetingCodeLookup {
    meetingId: string | null;
    name: string | null;
    status: number;
    expectedStartTime: string | null;
    expectedEndTime: string | null;
    hostName: string | null;
    isMember: boolean;
    canJoin: boolean;
    reason: 'NOT_FOUND' | 'NOT_INVITED' | 'CANCELLED' | 'ENDED' | null;
}

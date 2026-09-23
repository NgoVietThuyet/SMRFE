// DTO khớp chính xác với BE.Core/DTOs/MeetingDtos.cs
// Endpoint: GET /api/Meeting/dashboard → MeetingDashboardDto

import { ApiResponse } from './auth.models';

// Enum 1-1 với BE.Core.DTOs.MeetingStatus
export enum MeetingStatus {
    Draft = 0,
    Scheduled = 1,
    Ongoing = 2,
    Ended = 3,
    Cancelled = 4,
    Archived = 5,
}

// Enum 1-1 với BE.Core.DTOs.MeetingVisibility
export enum MeetingVisibility {
    InvitedOnly = 0,
    Internal = 1,
    Public = 2,
}

// Khớp với BE.Core.DTOs.MeetingListItemDto
export interface MeetingListItemDto {
    id: string;
    name: string;
    description: string;
    expectedStartTime: string;    // ISO 8601 UTC — BE serialize DateTime UTC
    expectedEndTime?: string | null;
    status: MeetingStatus;
    visibility: MeetingVisibility;
    roomCode: string;
    joinUrl: string;
    participantCount: number;
    isHost: boolean;
    hostName: string;
}

// Khớp với BE.Core.DTOs.MeetingDashboardDto
export interface MeetingDashboardDto {
    upcoming: number;             // count Scheduled
    ongoing: number;              // count Ongoing
    ended: number;                // count Ended
    cancelled: number;            // count Cancelled
    nextMeetings: MeetingListItemDto[];   // upcoming + ongoing, sorted asc, max 5
}

export type DashboardResponse = ApiResponse<MeetingDashboardDto>;

// Dữ liệu đã được xử lý cho component
export interface DashboardStats {
    upcoming: number;
    ongoing: number;
    ended: number;
    cancelled: number;
}

/**
 * Model phòng họp (P10) — khớp DTO BE-Java dto/mt/room, MeetingJoinInfoResponse, MeetingMessageResponse.
 * Thời gian BE trả về theo UTC (không kèm 'Z') → đọc bằng DateTimeUtils.fromUtc().
 */

/** Trạng thái xin vào phòng (EnterRoomResponse.state). */
export type EnterState = 'ADMITTED' | 'LOBBY' | 'REJECTED' | 'WAIT_HOST' | 'NOT_READY' | 'ENDED' | 'CANCELLED';

export interface EnterRoomResult {
    state: EnterState;
    requestId: string | null;
    message: string | null;
    isModerator: boolean;
}

/** MeetingJoinInfoResponse — GET /api/Meeting/{id}/join-info (chỉ khi đã ADMITTED). */
export interface JoinInfo {
    meetingId: string;
    name: string;
    roomCode: string;
    status: number;
    expectedStartTime: string;
    expectedEndTime: string;
    domain: string;
    roomName: string;
    displayName: string;
    isHost: boolean;
    isGuest: boolean;
    isModerator: boolean;
    externalApiUrl: string;
}

export interface LobbyRequest {
    id: string;
    userName: string;
    displayName: string;
    isGuest: boolean;
    requestedAt: string;
}

export interface RoomParticipant {
    userName: string;
    fullName: string;
    role: number;
    isModerator: boolean;
    isGuest: boolean;
    isOnline: boolean;
}

/** MeetingMessageResponse. receiverUserId rỗng = tin chung. */
export interface ChatMessage {
    id: string;
    meetingId: string;
    senderUserId: string;
    senderFullName: string;
    receiverUserId: string;
    messageText: string;
    createDate: string;
}

export interface WhiteboardState {
    revision: number;
    contentJson: string;
    isLocked: boolean;
    updatedBy: string | null;
    updatedAt: string | null;
}

/** AttendanceSummaryResponse — GET /api/Meeting/{id}/attendance. */
export interface AttendanceSummary {
    userName: string;
    fullName: string;
    role: number;
    isGuest: boolean;
    firstJoinAt: string | null;
    lastLeaveAt: string | null;
    joinCount: number;
    totalSeconds: number;
}

/** PublicMeetingResponse — GET /api/Meeting/public/{roomCode} (không cần đăng nhập). */
export interface PublicMeeting {
    meetingId: string | null;
    name: string | null;
    status: number;
    expectedStartTime: string | null;
    expectedEndTime: string | null;
    hostName: string | null;
    guestAllowed: boolean;
    reason: 'NOT_FOUND' | 'CANCELLED' | 'ENDED' | 'GUEST_NOT_ALLOWED' | null;
}

/** Phụ đề (MeetingCaptionDto). BE ghi đè speaker theo kết nối. */
export interface Caption {
    id: string;
    meetingId: string;
    speakerUserName: string;
    speakerName: string;
    text: string;
    language: 'vi-VN' | 'en-US';
    isFinal: boolean;
    timestamp: string;
}

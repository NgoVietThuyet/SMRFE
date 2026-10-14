/**
 * Model cuộc họp (P9) — khớp DTO BE-Java (dto/mt/meeting).
 * Mọi thời gian BE trả về là LocalDateTime theo UTC (không kèm 'Z') → đọc bằng DateTimeUtils.fromUtc().
 */

/** Trạng thái cuộc họp (MeetingInfos.Status). */
export enum MeetingStatus {
    Draft = 0,
    Scheduled = 1,
    Ongoing = 2,
    Ended = 3,
    Cancelled = 4,
    Archived = 5,
}

/** Chế độ hiển thị (MeetingInfos.Visibility). */
export enum MeetingVisibility {
    InvitedOnly = 0,
    Internal = 1,
    Public = 2,
}

/** Vai trò người tham gia (MeetingPersonals.Type). */
export enum MeetingRole {
    Host = 1,
    CoHost = 2,
    Secretary = 3,
    Required = 4,
    Optional = 5,
}

/** Tab danh sách "Cuộc họp của tôi" (MeetingSearchRequest.tab). */
export type MeetingTab = 'all' | 'upcoming' | 'ongoing' | 'history' | 'archived' | 'draft';

/** MeetingListItemResponse. */
export interface MeetingListItem {
    id: string;
    name: string;
    description: string;
    expectedStartTime: string;
    expectedEndTime: string | null;
    status: MeetingStatus;
    visibility: number;
    roomCode: string;
    joinUrl: string;
    participantCount: number;
    isHost: boolean;
    hostName: string;
}

/** MeetingSearchRequest — POST /api/Meeting/query. */
export interface MeetingQuery {
    tab: MeetingTab;
    keyword: string;
    status: number | null;
    page: number;
    pageSize: number;
    startDate: string | null;
    endDate: string | null;
}

/** MeetingSettingsDto (lưu trong MeetingInfos.SettingsJson). */
export interface MeetingSettings {
    schemaVersion: number;
    lobbyEnabled: boolean;
    allowGuests: boolean;
    allowJoinBeforeHost: boolean;
    chatEnabled: boolean;
    screenShareEnabled: boolean;
    whiteboardEnabled: boolean;
    fileUploadEnabled: boolean;
    recordingEnabled: boolean;
    captionsEnabled: boolean;
    aiMinutesEnabled: boolean;
    minutesTemplateId: string;
    passwordHash?: string;
    hasPassword?: boolean;
}

/** Giá trị mặc định — khớp MeetingSettingsDto.defaultSettings() của BE. */
export function defaultMeetingSettings(): MeetingSettings {
    return {
        schemaVersion: 1,
        lobbyEnabled: false,
        allowGuests: true,
        allowJoinBeforeHost: false,
        chatEnabled: true,
        screenShareEnabled: true,
        whiteboardEnabled: true,
        fileUploadEnabled: true,
        recordingEnabled: true,
        captionsEnabled: false,
        aiMinutesEnabled: true,
        minutesTemplateId: '',
    };
}

/** MeetingParticipantResponse. */
export interface MeetingParticipant {
    userName: string;
    fullName: string;
    email: string;
    organizationId: string;
    titleCode: string;
    role: MeetingRole;
    isJoined: boolean;
    joinTime: string | null;
}

/** MeetingAuditResponse (MeetingAuditLogs). */
export interface MeetingActivity {
    id: string;
    action: string;
    actorId: string;
    occurredAt: string;
    version: number;
    payloadJson: string;
}

/** MeetingDetailResponse — GET /api/Meeting/{id}. */
export interface MeetingDetail extends MeetingListItem {
    agenda: string;
    timeZone: string;
    cancellationReason: string | null;
    settings: MeetingSettings | null;
    participants: MeetingParticipant[];
    activity: MeetingActivity[];
    rowVersion: string;
    canManage: boolean;
    actualStartTime: string | null;
    actualEndTime: string | null;
}

/** Người tham gia khi tạo/thêm (MeetingParticipantInputDto). */
export interface MeetingParticipantInput {
    userName: string;
    role: MeetingRole;
}

/** CreateMeetingRequest. */
export interface CreateMeetingDto {
    name: string;
    description: string;
    agenda: string;
    expectedStartTime: string;
    expectedEndTime: string;
    timeZone: string;
    visibility: MeetingVisibility;
    saveAsDraft: boolean;
    publishInvitation: boolean;
    settings: MeetingSettings;
    participants: MeetingParticipantInput[];
}

/** UpdateMeetingRequest (PATCH /api/Meeting/{id}). publish = phát hành bản nháp. */
export interface UpdateMeetingDto {
    id: string;
    name: string;
    description: string;
    agenda: string;
    expectedStartTime: string | null;
    expectedEndTime: string | null;
    timeZone: string;
    visibility: MeetingVisibility;
    settings: MeetingSettings;
    rowVersion: string | null;
    publish: boolean;
}

/** ScheduleConflictResponse — POST /api/Meeting/schedule-conflicts. */
export interface ScheduleConflict {
    meetingId: string;
    meetingName: string;
    expectedStartTime: string;
    expectedEndTime: string;
    status: MeetingStatus;
    userName: string;
    fullName: string;
}

/** MeetingFileItemResponse — GET /api/File/GetMeetingFiles/{meetingId}. */
export interface MeetingFile {
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    type: number;
    createDate: string;
}

/** UserSearchResponse — GET /api/User/Search. */
export interface UserSearchItem {
    userName: string;
    fullName: string;
    email: string;
}

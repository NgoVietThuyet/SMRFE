import { ApiResponse } from './auth.models';
import { MeetingListItemDto } from './dashboard.models';

// Enum khớp BE.Core.DTOs.MeetingDtos (serialize số)
export enum MeetingVisibility {
    InvitedOnly = 0,
    Internal = 1,
    Public = 2,
}

// Cài đặt phòng họp — khớp MeetingSettingsDto (JSON camelCase).
// Không có field mật khẩu: BE lưu Settings nguyên văn, chưa có
// endpoint hash riêng nên v1 chưa cho đặt mật khẩu phòng.
export interface MeetingSettings {
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
}

// POST /api/Meeting — khớp CreateMeetingDto
export interface CreateMeetingRequest {
    name: string;
    description: string;
    agenda: string;
    expectedStartTime: string;
    expectedEndTime: string | null;
    timeZone: string;
    visibility: MeetingVisibility;
    saveAsDraft: boolean;
    publishInvitation: boolean;
    settings: MeetingSettings;
    participantUserNames: string[];
}

// GET /api/User/Search?q=&take= — gợi ý người tham gia
export interface UserSearchItem {
    userName: string;
    fullName: string;
    email: string;
}

// Vai trò người tham gia — khớp BE MeetingParticipantRole
export enum MeetingParticipantRole {
    Host = 1,
    CoHost = 2,
    Secretary = 3,
    Required = 4,
    Optional = 5,
}

// Khớp MeetingParticipantDto (GET /api/Meeting/{id} → Data.Participants)
export interface MeetingParticipantDto {
    userName: string;
    fullName: string;
    email: string;
    organizationId: string;
    titleCode: string;
    role: MeetingParticipantRole;
    isJoined: boolean;
    joinTime?: string | null;
}

// Khớp MeetingAuditDto (Data.Activity)
export interface MeetingAuditDto {
    id: string;
    action: string;
    actorId: string;
    occurredAt: string;
    version: number;
}

// Khớp MeetingDetailDto (GET /api/Meeting/{id} → Data)
export interface MeetingDetailDto extends MeetingListItemDto {
    agenda: string;
    timeZone: string;
    cancellationReason: string;
    settings: MeetingSettings & { minutesTemplateId: string; hasPassword: boolean };
    participants: MeetingParticipantDto[];
    activity: MeetingAuditDto[];
    rowVersion: string;
    canManage: boolean;
}

// POST /api/Meeting/query — khớp MeetingSearchDto
export interface MeetingSearchRequest {
    tab: string;
    keyword: string;
    status: number | null;
    page: number;
    pageSize: number;
    startDate: string | null;
    endDate: string | null;
}

// Khớp PagedResultDto<MeetingListItemDto> (BE trả trong Data)
export interface PagedMeetings {
    items: MeetingListItemDto[];
    totalItems: number;
    totalPages: number;
    page: number;
    pageSize: number;
}

// GET /api/Meeting/{id}/join-info — khớp MeetingJoinInfoDto
export interface MeetingJoinInfo {
    meetingId: string;
    roomName: string;
    domain: string;
    displayName: string;
    isModerator: boolean;
    startWithAudioMuted: boolean;
    startWithVideoMuted: boolean;
}

export type CreateMeetingResponse = ApiResponse<{ id: string }>;

// PATCH /api/Meeting/{id} — khớp UpdateMeetingDto (RowVersion base64, rỗng = bỏ qua)
export interface UpdateMeetingRequest {
    name: string;
    description: string;
    agenda: string;
    expectedStartTime: string;
    expectedEndTime: string | null;
    timeZone: string;
    visibility: number;
    settings: MeetingSettings;
    rowVersion: string;
}

// POST /api/Meeting/{id}/cancel — reason bắt buộc ≤ 1000 ký tự
export interface CancelMeetingRequest {
    reason: string;
}

// POST /api/Meeting/{id}/participants — thêm theo userName
export interface AddParticipantsRequest {
    userNames: string[];
}

// GET /api/File/GetMeetingFiles/{meetingId} — khớp anonymous BE
// Type: 2 = recording (Jibri upload), còn lại = tài liệu
export interface MeetingFileDto {
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    type: number;
    createDate: string;
}

// GET /api/File/Download/{fileId} — url ký 900s
export interface FileDownloadDto {
    url: string;
    expiresIn: number;
}

// GET /api/Meeting/{id}/messages — khớp anonymous BE (camelCase)
export interface ChatMessage {
    id: string;
    senderUserId: string;
    senderName: string;
    messageText: string;
    createdAt: string;
}

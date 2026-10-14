/** P13 — Biên bản họp. Khớp dto/mt/minutes/* của BE-Java. Giờ là UTC (DateTimeUtils.fromUtc). */

export enum MinutesStatus {
    Draft = 0,
    Submitted = 1,
    Approved = 2,
    Published = 3,
    Rejected = 4,
}

export const MINUTES_STATUS_META: Record<MinutesStatus, { label: string; color: string }> = {
    [MinutesStatus.Draft]: { label: 'Nháp', color: 'default' },
    [MinutesStatus.Submitted]: { label: 'Chờ duyệt', color: 'processing' },
    [MinutesStatus.Approved]: { label: 'Đã duyệt', color: 'cyan' },
    [MinutesStatus.Published]: { label: 'Đã phát hành', color: 'success' },
    [MinutesStatus.Rejected]: { label: 'Bị từ chối', color: 'error' },
};

/** SyBackgroundJobs.Status */
export enum JobStatus {
    Pending = 0,
    Running = 1,
    Done = 2,
    Failed = 3,
}

export interface MinutesDecision {
    id: string | null;
    text: string;
    sources: string[];
}

export interface MinutesActionItem {
    id: string | null;
    text: string;
    assignee: string | null;
    assigneeName: string | null;
    /** yyyy-MM-dd */
    dueDate: string | null;
    sources: string[];
    confirmed: boolean;
    taskId: string | null;
}

export interface MinutesContent {
    summary: string;
    summarySources: string[];
    decisions: MinutesDecision[];
    actions: MinutesActionItem[];
}

export interface MinutesVersion {
    id: string;
    version: number;
    status: MinutesStatus;
    content: MinutesContent;
    source: 'AI' | 'MANUAL';
    model: string | null;
    promptVersion: string | null;
    rejectReason: string | null;
    createdBy: string;
    createdAt: string;
    updatedBy: string | null;
    updatedAt: string | null;
    submittedBy: string | null;
    submittedAt: string | null;
    approvedBy: string | null;
    approvedAt: string | null;
    publishedBy: string | null;
    publishedAt: string | null;
    /** Mục thiếu nguồn — còn cảnh báo thì không phát hành được. */
    warnings: string[];
}

export interface MinutesJob {
    id: string;
    status: JobStatus;
    error: string | null;
    createdAt: string;
    finishedAt: string | null;
    reused: boolean;
}

export interface MinutesDetail {
    meetingId: string;
    meetingName: string;
    meetingStatus: number;
    startTime: string | null;
    endTime: string | null;
    isModerator: boolean;
    isSecretary: boolean;
    canGenerate: boolean;
    canEdit: boolean;
    canApprove: boolean;
    current: MinutesVersion | null;
    versions: { version: number; status: MinutesStatus; source: string; createdAt: string }[];
    job: MinutesJob | null;
    participants: { userName: string; fullName: string }[];
    transcriptCount: number;
}

export interface MinutesListItem {
    meetingId: string;
    meetingName: string;
    roomCode: string;
    meetingStatus: number;
    startTime: string | null;
    endTime: string | null;
    hostName: string;
    transcriptCount: number;
    minutesVersion: number | null;
    minutesStatus: MinutesStatus | null;
    publishedAt: string | null;
}

/** Mẫu biên bản đang dùng của cuộc họp (MinutesTemplateInfo). */
export interface MinutesTemplateInfo {
    source: 'MEETING' | 'SYSTEM' | 'BUILTIN';
    fileId: string | null;
    fileName: string;
    format: 'DOCX' | 'PDF';
    uploadedBy: string | null;
    uploadedByName: string | null;
    uploadedAt: string | null;
    sections: string[];
    canDelete: boolean;
}

/** Job "Tải biên bản họp" (status như JobStatus). */
export interface MinutesExport {
    id: string;
    meetingId: string;
    meetingName: string;
    status: JobStatus;
    error: string | null;
    reused: boolean;
}

/** MeetingCaptionDto — một đoạn transcript. */
export interface TranscriptSegment {
    id: string;
    meetingId: string;
    speakerUserName: string | null;
    speakerName: string | null;
    text: string;
    language: string | null;
    timestamp: string;
}

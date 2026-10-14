/** Model nhóm Quản trị — khớp DTO của BE-Java (dto/md/hr, dto/ad/employee, dto/ad/permission, dto/sy, dto/rp). */

// ───────────── P1 Cơ cấu tổ chức ─────────────

/** OrganizationNodeResponse — GET /api/human-resources/organization-tree (danh sách phẳng, gốc có pId = ''). */
export interface OrganizationNode {
    id: string;
    pId: string;
    name: string;
    orderNumber: number;
    expanded: boolean;
    isActive: boolean;
    notes: string | null;
    employeeCount: number;
}

/** OrganizationRequest — POST/PUT /organizations. */
export class OrganizationDto {
    name: string = '';
    parentId: string = '';
    orderNumber: number = 0;
    isActive: boolean = true;
    notes: string = '';
}

// ───────────── P2 Chức danh ─────────────

/** TitleResponse — GET /api/human-resources/titles. */
export interface Title {
    code: string;
    name: string;
    notes: string;
    orderNumber: number;
    isActive: boolean;
    employeeCount: number;
}

/** TitleRequest — POST/PUT /titles. */
export class TitleDto {
    code: string = '';
    name: string = '';
    notes: string = '';
    orderNumber: number = 0;
    isActive: boolean = true;
}

// ───────────── P3 Tài khoản ─────────────

/** EmployeeItemResponse / EmployeeDetailResponse. */
export interface Employee {
    userName: string;
    fullName: string;
    email: string;
    phone: string;
    address: string;
    orgId: string;
    organizationName: string | null;
    titleCode: string;
    titleName: string | null;
    isActive: boolean;
    mustChangePassword: boolean;
    lastLoginAt: string | null;
    createDate: string | null;
    updateDate?: string | null;
    roleCodes: string | null;
}

export class EmployeeFilter {
    organizationId: string | null = null;
    titleCode: string | null = null;
    active: boolean | null = null;
    keyword: string = '';
    page: number = 1;
    pageSize: number = 20;
}

/** EmployeeRequest (tạo có username) / UpdateEmployeeRequest. Tạo từ danh bạ thì BE tự sinh username. */
export class EmployeeDto {
    userName: string = '';
    fullName: string = '';
    email: string = '';
    phone: string = '';
    address: string = '';
    organizationId: string = '';
    titleCode: string = '';
}

export interface CreatedEmployee {
    userName: string;
    fullName: string;
    email: string;
    temporaryPassword: string;
    mustChangePassword: boolean;
}

// ───────────── P4 Phân quyền ─────────────

export type PermissionEffect = 'Inherit' | 'Allow' | 'Deny';
export type PermissionTargetType = 'organization' | 'title' | 'account';

export interface PermissionDefinition {
    code: string;
    name: string;
    group: string;
}

export interface PermissionCatalogGroup {
    groupName: string;
    permissions: PermissionDefinition[];
}

/** PermissionDocument — GET/PUT /{type}/{id}/permissions. Khóa thiếu = Inherit. */
export interface PermissionDocument {
    version: number;
    permissions: Record<string, PermissionEffect>;
}

export interface EffectivePermission {
    code: string;
    name: string;
    allowed: boolean;
    effect: string;
    sourceType: string;
    sourceId: string | null;
    sourceName: string | null;
}

// ───────────── P5 Thống kê ─────────────

export interface MeetingReport {
    from: string;
    to: string;
    meetingCount: number;
    draftCount: number;
    upcomingCount: number;
    ongoingCount: number;
    endedCount: number;
    cancelledCount: number;
    totalHours: number;
    participantCount: number;
    attendedCount: number;
    byWeek: { weekStart: string; meetingCount: number; hours: number }[];
    byOrganization: {
        organizationId: string | null;
        organizationName: string;
        meetingCount: number;
        hours: number;
        participantCount: number;
    }[];
}

export interface TaskReport {
    from: string;
    to: string;
    total: number;
    notStarted: number;
    inProgress: number;
    completed: number;
    overdue: number;
}

/** AiPipelineReportResponse — GET /api/admin/reports/ai-pipeline (job AI nền từ SyBackgroundJobs). */
export interface AiPipelineReport {
    from: string;
    to: string;
    total: number;
    pending: number;
    running: number;
    done: number;
    failed: number;
    /** % xong / (xong + lỗi) */
    successRate: number;
    avgWaitSeconds: number;
    avgRunSeconds: number;
    p95RunSeconds: number;
    byType: { type: string; label: string; total: number; done: number; failed: number; avgRunSeconds: number }[];
    recentFailures: {
        id: string; type: string; label: string; meetingId: string | null; meetingName: string;
        error: string | null; createdBy: string; createdAt: string;
    }[];
}

export interface HumanResourceSummary {
    organizationCount: number;
    employeeCount: number;
    activeAccountCount: number;
    lockedAccountCount: number;
    employeesByOrganization: { id: string; name: string; count: number }[];
}

// ───────────── P6 Nhật ký ─────────────

export interface AuditLog {
    id: string;
    category: string;
    action: string;
    actorUserName: string | null;
    targetType: string | null;
    targetId: string | null;
    success: boolean;
    httpStatus: number;
    ip: string | null;
    userAgent: string | null;
    payloadJson: string | null;
    /** UTC, không kèm múi giờ. */
    occurredAt: string;
}

export class AuditLogFilter {
    from: Date | null = null;
    to: Date | null = null;
    category: string | null = null;
    actor: string = '';
    success: boolean | null = null;
    keyword: string = '';
    page: number = 1;
    pageSize: number = 20;
}

// ───────────── P7 Cấu hình ─────────────

export interface SystemSettings {
    maxUploadSizeMb: number;
    allowedExtensions: string[];
    recordingRetentionDays: number;
    defaultMinutesTemplateId: string;
}

export interface MinutesTemplate {
    id: string;
    fileName: string;
    fileSize: number;
    isDefault: boolean;
    createBy: string;
    createDate: string;
}

export const REQUIRED_TEMPLATE_PLACEHOLDERS = [
    '{{meeting_name}}', '{{time}}', '{{participants}}', '{{summary}}', '{{decisions}}', '{{action_items}}',
];

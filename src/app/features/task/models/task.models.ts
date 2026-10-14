/**
 * Model Công việc (P12) — khớp DTO BE-Java dto/mt/task + dto/mt/task/board.
 * Công việc (Level 0) = bảng · Đầu việc (Level 1) = cột · Việc nhỏ (Level 2) = thẻ.
 * Thời gian BE trả về theo UTC (không kèm 'Z') → đọc bằng DateTimeUtils.fromUtc().
 */

/** MeetingTasks.Status */
export enum TaskStatus {
    NotStarted = 0,
    InProgress = 1,
    Completed = 2,
}

/** TaskListItemResponse */
export interface TaskListItem {
    id: string;
    meetingId: string | null;
    meetingName: string | null;
    meetingStartTime?: string | null;
    parentId: string | null;
    level: number;
    childrenCount?: number;
    completedChildrenCount?: number;
    progress?: number;
    title: string;
    description?: string | null;
    assigneeUserName: string | null;
    assigneeFullName: string | null;
    dueDate: string | null;
    status: TaskStatus;
    priority: number;
    isPublic?: boolean;
    isCreator?: boolean;
    canEdit?: boolean;
    createBy?: string;
    createDate?: string;
    updateDate?: string;
    sourceRef?: string | null;
    startDate?: string | null;
    sortOrder?: number;
    color?: string | null;
    isArchived?: boolean;
    cardCount?: number;
    cardDoneCount?: number;
}

/** Nhóm ở sidebar trang Công việc. */
export type TaskGroup = 'today' | 'overdue' | 'mine' | 'assigned' | 'shared' | 'public' | `meeting:${string}`;

/** TaskSearchRequest — POST /api/Task/query. */
export interface TaskQuery {
    shortcut: 'all' | 'mine' | 'today' | 'overdue';
    keyword: string;
    meetingId: string | null;
    assignee: string | null;
    status: number | null;
    priority: number | null;
    level: number | null;
    parentId: string | null;
    page: number;
    pageSize: number;
    group: 'mine' | 'assigned' | 'shared' | 'public' | null;
    includeArchived: boolean;
}

export interface TaskSearchResult {
    items: TaskListItem[];
    totalItems: number;
    totalPages: number;
    page: number;
    pageSize: number;
}

/** TaskGroupsResponse — GET /api/Task/groups. */
export interface TaskGroups {
    today: number;
    overdue: number;
    mine: number;
    assigned: number;
    shared: number;
    publicCount: number;
    meetings: { meetingId: string; name: string; startTime: string | null; count: number }[];
}

export interface TaskLabel {
    id: string;
    name: string;
    color: string;
}

export interface BoardMember {
    userName: string;
    fullName: string;
    role: 'owner' | 'edit' | 'view' | 'assignee';
}

/** BoardCardResponse — một thẻ. */
export interface BoardCard {
    id: string;
    parentId: string;
    title: string;
    description: string | null;
    assigneeUserName: string | null;
    assigneeFullName: string | null;
    startDate: string | null;
    dueDate: string | null;
    status: TaskStatus;
    priority: number;
    sortOrder: number;
    isArchived: boolean;
    labelIds: string[];
    checklistDone: number;
    checklistTotal: number;
    commentCount: number;
    fileCount: number;
    createBy: string;
    canWork: boolean;
}

/** BoardListResponse — một cột. */
export interface BoardList {
    id: string;
    title: string;
    sortOrder: number;
    cards: BoardCard[];
}

/** BoardResponse — GET /api/Task/{workId}/board. */
export interface Board {
    work: TaskListItem;
    lists: BoardList[];
    labels: TaskLabel[];
    members: BoardMember[];
    canEdit: boolean;
    isOwner: boolean;
    archivedCount: number;
}

export interface ChecklistItem {
    id: string;
    content: string;
    isDone: boolean;
    sortOrder: number;
}

export interface TaskComment {
    id: string;
    userName: string;
    fullName: string;
    content: string;
    createDate: string;
    canDelete: boolean;
}

export interface TaskFile {
    id: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    createBy: string;
    createDate: string;
    canDelete: boolean;
}

/** CardDetailResponse — GET /api/Task/{id}/card. */
export interface CardDetail {
    card: BoardCard;
    workId: string;
    listTitle: string | null;
    createByFullName: string;
    createDate: string;
    sourceRef: string | null;
    labels: TaskLabel[];
    checklist: ChecklistItem[];
    comments: TaskComment[];
    files: TaskFile[];
    canEdit: boolean;
    isOwner: boolean;
}

/** TaskShareResponse */
export interface TaskShare {
    userName: string;
    fullName: string;
    permission: 0 | 1;
}

/** TaskDetailResponse (dùng cho chia sẻ). */
export interface TaskDetail extends TaskListItem {
    shares: TaskShare[];
    children: TaskListItem[];
}

/** CreateTaskRequest */
export interface CreateTaskDto {
    meetingId: string | null;
    parentId: string | null;
    level: number;
    title: string;
    description: string | null;
    assigneeUserName: string | null;
    dueDate: string | null;
    status: TaskStatus;
    priority: number;
    isPublic: boolean;
    sourceRef: string | null;
    startDate: string | null;
    color: string | null;
}

/** UpdateTaskRequest — BE yêu cầu gửi đủ các trường chính mỗi lần. */
export interface UpdateTaskDto {
    title: string;
    description: string | null;
    assigneeUserName: string | null;
    dueDate: string | null;
    status: TaskStatus;
    priority: number;
    sourceRef: string | null;
    parentId: string | null;
    level: number | null;
    startDate: string | null;
    color: string | null;
    isArchived: boolean | null;
    clearDates: boolean | null;
}

// ===================== Hằng số giao diện (theo 2.FrontEnd features/task/models) =====================

export const BOARD_BACKGROUNDS = [
    '#0079BF', '#D29034', '#519839', '#B04632',
    '#89609E', '#CD5A91', '#4BBF6B', '#00AECC',
    '#838C91', '#E74C3C', '#2ECC71', '#3498DB',
];
export const BACKGROUND_COLOR_DEFAULT = '#0079BF';

export const LABEL_COLORS = [
    { color: '#61BD4F', name: 'Xanh lá' },
    { color: '#F2D600', name: 'Vàng' },
    { color: '#FF9F1A', name: 'Cam' },
    { color: '#EB5A46', name: 'Đỏ' },
    { color: '#C377E0', name: 'Tím' },
    { color: '#0079BF', name: 'Xanh dương' },
    { color: '#00C2E0', name: 'Xanh nhạt' },
    { color: '#51E898', name: 'Xanh mint' },
    { color: '#FF78CB', name: 'Hồng' },
    { color: '#344563', name: 'Đen' },
];

/** Ưu tiên của BE: 0 Thấp · 1 Trung bình · 2 Cao (mẫu có 4 mức, SMR giữ 3). */
export const PRIORITY_LIST = [
    { value: 0, label: 'Thấp', color: '#52c41a' },
    { value: 1, label: 'Trung bình', color: '#faad14' },
    { value: 2, label: 'Cao', color: '#f5222d' },
];

/** Màu nhóm (cột) ở dạng Danh sách / Timeline — theo task-gantt-view của 2.FrontEnd. */
export const LIST_COLORS = ['#0079BF', '#61BD4F', '#FF9F1A', '#C377E0', '#EB5A46', '#00C2E0', '#344563', '#FF78CB'];

export function priorityMeta(p: number | null | undefined): { value: number; label: string; color: string } | null {
    return PRIORITY_LIST.find(x => x.value === p) ?? null;
}

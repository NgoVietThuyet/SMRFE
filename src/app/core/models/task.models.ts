// Khớp BE.Core.DTOs.TaskDtos (serialize camelCase).

// Trạng thái công việc — TaskStatus (BE: NotStarted=0/InProgress=1/Completed=2)
export enum TaskStatus {
    NotStarted = 0,
    InProgress = 1,
    Completed = 2,
}

// Ưu tiên công việc — TaskPriority (Low=0/Medium=1/High=2)
export enum TaskPriority {
    Low = 0,
    Medium = 1,
    High = 2,
}

// Quyền chia sẻ — TaskSharePermission (View=0/Edit=1)
export enum TaskSharePermission {
    View = 0,
    Edit = 1,
}

// POST /api/Task/query — khớp TaskSearchDto
export interface TaskSearchRequest {
    shortcut: 'all' | 'mine' | 'overdue' | 'today';
    keyword: string;
    meetingId: string | null;
    assignee: string | null; // userName | 'none'
    status: number | null;
    priority: number | null;
    level?: number | null; // 0=Work, 1=SubWork, 2=Task
    parentId?: string | null;
    page: number;
    pageSize: number;
}

// Số đếm chip Tất cả/Của tôi/Quá hạn/Hôm nay — tính trên bộ lọc cơ sở
export interface TaskSummary {
    total: number;
    mine: number;
    overdue: number;
    today: number;
}

// Khớp TaskListItemDto — cờ quyền tính theo người yêu cầu tại BE + hierarchy
export interface TaskListItem {
    id: string;
    meetingId: string | null;
    meetingName: string | null;
    meetingStartTime?: string | null;
    parentId: string | null;
    level: number; // 0=Work, 1=SubWork, 2=Task
    childrenCount: number;
    completedChildrenCount: number;
    progress: number; // 0-100
    title: string;
    description: string | null;
    assigneeUserName: string | null;
    assigneeFullName: string | null;
    dueDate: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    isPublic: boolean;
    isCreator: boolean;
    canEdit: boolean;
    createBy: string;
    createDate: string | null;
    updateDate: string | null;
    sourceRef?: string | null;
}

// Khớp TaskDetailDto — shares chỉ có khi requester là người tạo + children cấp 1
export interface TaskDetail extends TaskListItem {
    shares: TaskShare[];
    children: TaskListItem[];
}

// Khớp TaskShareDto
export interface TaskShare {
    userName: string;
    fullName: string;
    permission: TaskSharePermission;
}

// POST /api/Task — khớp CreateTaskDto
export interface CreateTaskRequest {
    meetingId: string | null;
    parentId?: string | null;
    level?: number;
    title: string;
    description: string | null;
    assigneeUserName: string | null;
    dueDate: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    isPublic: boolean;
    sourceRef?: string | null;
}

// PUT /api/Task/{id} — khớp UpdateTaskDto (share/public đi endpoint riêng)
export interface UpdateTaskRequest {
    title: string;
    description: string | null;
    assigneeUserName: string | null;
    dueDate: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    sourceRef?: string | null;
    parentId?: string | null;
    level?: number | null;
}

// PUT /api/Task/{id}/visibility — khớp TaskVisibilityDto
export interface TaskVisibilityRequest {
    isPublic: boolean;
}

// POST /api/Task/{id}/shares — khớp TaskShareInputDto
export interface TaskShareRequest {
    userName: string;
    permission: TaskSharePermission;
}

// Khớp TaskSearchResultDto (BE trả trong Data)
export interface TaskSearchResult {
    items: TaskListItem[];
    totalItems: number;
    totalPages: number;
    page: number;
    pageSize: number;
    summary: TaskSummary;
}

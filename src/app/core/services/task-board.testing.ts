// Dữ liệu mẫu dùng chung cho test module Kanban (không phải spec).
import {
    ArrowLeftOutline,
    CheckCircleOutline,
    CheckSquareOutline,
    ClockCircleOutline,
    DeleteOutline,
    EditOutline,
    LockOutline,
    MoreOutline,
    PlusOutline,
    UserAddOutline,
} from '@ant-design/icons-angular/icons';
import { TaskDetail, TaskListItem, TaskPriority, TaskStatus } from '../models/task.models';

export const TEST_ICONS = [
    ArrowLeftOutline,
    CheckCircleOutline,
    CheckSquareOutline,
    ClockCircleOutline,
    DeleteOutline,
    EditOutline,
    LockOutline,
    MoreOutline,
    PlusOutline,
    UserAddOutline,
];

export function makeTask(patch: Partial<TaskListItem> = {}): TaskListItem {
    return {
        id: 'c1',
        meetingId: null,
        meetingName: null,
        parentId: 'w1',
        level: 1,
        childrenCount: 0,
        completedChildrenCount: 0,
        progress: 0,
        title: 'Thẻ',
        description: null,
        assigneeUserName: null,
        assigneeFullName: null,
        dueDate: null,
        status: TaskStatus.NotStarted,
        priority: TaskPriority.Medium,
        isPublic: false,
        isCreator: true,
        canEdit: true,
        createBy: 'me',
        createDate: '2026-10-01T00:00:00',
        updateDate: null,
        ...patch,
    };
}

export const BOARD: TaskDetail = {
    ...makeTask({ id: 'w1', parentId: null, level: 0, title: 'Bảng A' }),
    shares: [],
    children: [],
};

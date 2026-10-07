import { TaskPriority, TaskStatus } from '../../core/models/task.models';

// Hiển thị dùng chung cho bảng Kanban + chi tiết đầu việc.

const PRIORITY_LABEL: Record<number, string> = {
    [TaskPriority.Low]: 'Thấp',
    [TaskPriority.Medium]: 'Trung bình',
    [TaskPriority.High]: 'Cao',
};

export function priorityLabel(priority: number): string {
    return PRIORITY_LABEL[priority] ?? 'Trung bình';
}

/** 'is-overdue' khi quá hạn, 'is-due-soon' khi còn ≤ 48 giờ; việc đã xong không cảnh báo. */
export function dueClass(dueDate: string | null, status: TaskStatus, now = Date.now()): string {
    if (!dueDate || status === TaskStatus.Completed) return '';
    const due = new Date(dueDate).getTime();
    if (due < now) return 'is-overdue';
    if (due - now <= 48 * 3600_000) return 'is-due-soon';
    return '';
}

/** "Hôm nay", "09/10", "09/10/2027" (khác năm). */
export function shortDate(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Hôm nay';
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    return d.getFullYear() !== today.getFullYear() ? `${day}/${month}/${d.getFullYear()}` : `${day}/${month}`;
}

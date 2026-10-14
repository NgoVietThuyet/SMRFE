import { DateTimeUtils } from '../../../shared/utils';
import { BoardCard, LIST_COLORS, TaskLabel, TaskStatus } from '../models/task.models';

/** Nhóm hiển thị ở dạng Danh sách / Timeline (cột của bảng hoặc nhóm ở lối tắt Hôm nay / Quá hạn). */
export interface CardGroup {
    id: string;
    name: string;
    cards: BoardCard[];
}

export const TaskUi = {
    listColor(index: number): string {
        return LIST_COLORS[index % LIST_COLORS.length];
    },

    isDone(card: { status: TaskStatus }): boolean {
        return card.status === TaskStatus.Completed;
    },

    /** Quá hạn: hạn đã qua và chưa xong. */
    isOverdue(card: { dueDate: string | null; status: TaskStatus }): boolean {
        const due = DateTimeUtils.fromUtc(card.dueDate);
        return !!due && card.status !== TaskStatus.Completed && due.getTime() < Date.now();
    },

    /** Sắp đến hạn: trong 24 giờ tới. */
    isDueSoon(card: { dueDate: string | null; status: TaskStatus }): boolean {
        const due = DateTimeUtils.fromUtc(card.dueDate);
        if (!due || card.status === TaskStatus.Completed) return false;
        const diff = due.getTime() - Date.now();
        return diff >= 0 && diff <= 86_400_000;
    },

    /** "12/10" hoặc "12/10/2027" nếu khác năm. */
    shortDate(value: string | null): string {
        const d = DateTimeUtils.fromUtc(value);
        if (!d) return '';
        const p = (n: number) => String(n).padStart(2, '0');
        const base = `${p(d.getDate())}/${p(d.getMonth() + 1)}`;
        return d.getFullYear() === new Date().getFullYear() ? base : `${base}/${d.getFullYear()}`;
    },

    dateTime(value: string | null): string {
        const d = DateTimeUtils.fromUtc(value);
        if (!d) return '';
        const p = (n: number) => String(n).padStart(2, '0');
        return `${p(d.getHours())}:${p(d.getMinutes())} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
    },

    labelsOf(card: BoardCard, labels: TaskLabel[]): TaskLabel[] {
        if (!card.labelIds?.length) return [];
        return labels.filter(l => card.labelIds.includes(l.id));
    },

    initials(name: string | null | undefined): string {
        const parts = (name || '?').trim().split(/\s+/);
        return parts.length > 1
            ? (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
            : parts[0].substring(0, 2).toUpperCase();
    },

    /** Màu cố định theo chuỗi (ô chữ cái ở sidebar). */
    colorOf(text: string): string {
        let h = 0;
        for (const ch of text || '') h = (h * 31 + ch.charCodeAt(0)) | 0;
        return LIST_COLORS[Math.abs(h) % LIST_COLORS.length];
    },
};

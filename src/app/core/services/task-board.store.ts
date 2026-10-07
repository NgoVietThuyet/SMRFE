import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, forkJoin, of } from 'rxjs';
import {
    CreateTaskRequest,
    TaskDetail,
    TaskListItem,
    TaskPriority,
    TaskStatus,
    UpdateTaskRequest,
} from '../models/task.models';
import { friendlyError } from '../../shared/utils/friendly-error';
import { TaskService } from './task.service';

export type BoardErrorKind = 'error' | 'forbidden' | 'notfound';

export interface BoardError {
    kind: BoardErrorKind;
    message: string;
}

// BE trả tối đa 100 item/trang.
export const BOARD_PAGE_SIZE = 100;

// Thẻ trong cột: chưa xong trước, ưu tiên cao → hạn gần (không hạn xuống cuối) → tạo trước.
export function compareCards(a: TaskListItem, b: TaskListItem): number {
    const da = a.status === TaskStatus.Completed ? 1 : 0;
    const db = b.status === TaskStatus.Completed ? 1 : 0;
    if (da !== db) return da - db;
    if (a.priority !== b.priority) return b.priority - a.priority;
    const ta = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
    const tb = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
    if (ta !== tb) return ta - tb;
    return (a.createDate ?? '').localeCompare(b.createDate ?? '');
}

// Cột (Đầu việc) xếp theo thời điểm tạo: cột mới nằm bên phải.
export function compareLists(a: TaskListItem, b: TaskListItem): number {
    return (a.createDate ?? '').localeCompare(b.createDate ?? '');
}

/** PUT /api/Task cần đủ field — dựng từ item hiện tại + phần thay đổi. */
export function updatePayload(t: TaskListItem, patch: Partial<UpdateTaskRequest> = {}): UpdateTaskRequest {
    return {
        title: t.title,
        description: t.description,
        assigneeUserName: t.assigneeUserName,
        dueDate: t.dueDate,
        status: t.status,
        priority: t.priority,
        sourceRef: t.sourceRef ?? null,
        ...patch,
    };
}

/** Phân loại lỗi tải bảng: 403 / 404 không được giả làm "rỗng" (đặc tả §7). */
export function classifyBoardError(err: unknown): BoardError {
    const status = err instanceof HttpErrorResponse ? err.status : 0;
    const raw = err instanceof Error ? err.message : '';
    if (status === 403 || /không có quyền|chỉ có quyền/i.test(raw)) {
        return { kind: 'forbidden', message: 'Bạn không có quyền xem công việc này.' };
    }
    // BE trả "Không tìm thấy công việc." cho cả task không tồn tại lẫn task không được xem.
    if (status === 404 || /không tìm thấy/i.test(raw)) {
        return { kind: 'notfound', message: 'Công việc không tồn tại hoặc đã bị xóa.' };
    }
    return { kind: 'error', message: friendlyError(err, 'Không thể tải bảng công việc.') };
}

function permissionError(err: unknown, fallback: string): string {
    const status = err instanceof HttpErrorResponse ? err.status : 0;
    if (status === 403 || /quyền/i.test(err instanceof Error ? err.message : '')) {
        return 'Bạn không có quyền sửa mục này.';
    }
    return friendlyError(err, fallback);
}

function toListItem(detail: TaskDetail): TaskListItem {
    const { shares: _shares, children: _children, ...item } = detail;
    return item;
}

// =====================================================
// TaskBoardStore — trạng thái một bảng Kanban:
//   Công việc (level 0) = bảng
//   Đầu việc  (level 1) = cột, người dùng tự tạo / đặt tên
//   Việc nhỏ  (level 2) = thẻ trong cột
// Cung cấp ở cấp component TaskBoard để drawer chi tiết dùng chung.
// =====================================================
@Injectable()
export class TaskBoardStore {
    private readonly taskService = inject(TaskService);

    readonly workId = signal<string | null>(null);
    readonly board = signal<TaskDetail | null>(null);
    readonly lists = signal<TaskListItem[]>([]);
    readonly cards = signal<TaskListItem[]>([]);
    readonly loading = signal(false);
    readonly error = signal<BoardError | null>(null);
    /** Có cột/thẻ vượt giới hạn 1 trang của BE. */
    readonly truncated = signal(false);
    /** Id thẻ/cột đang chờ API — khóa thao tác để chống gửi trùng. */
    readonly pending = signal<ReadonlySet<string>>(new Set());
    /** Lọc thẻ theo người phụ trách: '' = tất cả, 'none' = chưa gán. */
    readonly assigneeFilter = signal<string>('');

    readonly sortedLists = computed(() => [...this.lists()].sort(compareLists));

    readonly cardsByList = computed(() => {
        const f = this.assigneeFilter();
        const groups = new Map<string, TaskListItem[]>();
        for (const l of this.lists()) groups.set(l.id, []);
        for (const c of this.cards()) {
            if (f && (f === 'none' ? !!c.assigneeUserName : c.assigneeUserName !== f)) continue;
            groups.get(c.parentId ?? '')?.push(c);
        }
        for (const list of groups.values()) list.sort(compareCards);
        return groups;
    });

    /** Tiến độ bảng = số việc nhỏ hoàn thành / tổng việc nhỏ. */
    readonly progress = computed(() => {
        const all = this.cards();
        const done = all.filter((c) => c.status === TaskStatus.Completed).length;
        return { done, total: all.length, percent: all.length ? Math.round((done / all.length) * 100) : 0 };
    });

    readonly assignees = computed(() => {
        const map = new Map<string, string>();
        for (const c of this.cards()) {
            if (c.assigneeUserName) map.set(c.assigneeUserName, c.assigneeFullName || c.assigneeUserName);
        }
        return [...map.entries()].map(([userName, fullName]) => ({ userName, fullName }));
    });

    isPending(id: string): boolean {
        return this.pending().has(id);
    }

    card(id: string): TaskListItem | undefined {
        return this.cards().find((c) => c.id === id);
    }

    list(id: string): TaskListItem | undefined {
        return this.lists().find((l) => l.id === id);
    }

    async load(workId: string, opts: { quiet?: boolean } = {}): Promise<void> {
        if (this.workId() !== workId) {
            this.workId.set(workId);
            this.board.set(null);
            this.lists.set([]);
            this.cards.set([]);
            this.assigneeFilter.set('');
        }
        if (!opts.quiet) this.loading.set(true);
        this.error.set(null);
        try {
            const { board, result } = await firstValueFrom(
                forkJoin({ board: this.taskService.get(workId), result: this.taskService.query(this.childQuery(workId, 1)) })
            );
            const lists = result.items ?? [];
            // Mỗi cột một request lấy việc nhỏ (số cột của một bảng thường nhỏ).
            const cardResults = lists.length
                ? await firstValueFrom(forkJoin(lists.map((l) => this.taskService.query(this.childQuery(l.id, 2)))))
                : await firstValueFrom(of([]));
            if (this.workId() !== workId) return; // đã chuyển sang bảng khác
            this.board.set(board);
            this.lists.set(lists);
            // Thẻ đang chờ API giữ bản optimistic để không "nhảy" ngược.
            const pending = this.pending();
            const local = new Map(this.cards().map((c) => [c.id, c]));
            const cards = cardResults.flatMap((r) => r.items ?? []);
            this.cards.set(cards.map((c) => (pending.has(c.id) ? (local.get(c.id) ?? c) : c)));
            this.truncated.set(
                (result.totalItems ?? 0) > lists.length || cardResults.some((r) => (r.totalItems ?? 0) > (r.items?.length ?? 0))
            );
        } catch (err) {
            if (this.workId() !== workId) return;
            // Làm mới ngầm lỗi mạng: giữ dữ liệu cũ. Bảng bị xóa / mất quyền thì vẫn phải báo.
            const e = classifyBoardError(err);
            if (!opts.quiet || !this.board() || e.kind !== 'error') this.error.set(e);
        } finally {
            if (this.workId() === workId) this.loading.set(false);
        }
    }

    private childQuery(parentId: string, level: number) {
        return {
            shortcut: 'all' as const,
            keyword: '',
            meetingId: null,
            assignee: null,
            status: null,
            priority: null,
            level,
            parentId,
            page: 1,
            pageSize: BOARD_PAGE_SIZE,
        };
    }

    // ── Cột (Đầu việc) ─────────────────────────────

    async addList(title: string): Promise<TaskListItem> {
        const board = this.board();
        if (!board) throw new Error('Chưa tải xong bảng.');
        const created = await firstValueFrom(this.taskService.create(this.createPayload(board, 1, title)));
        this.lists.update((list) => [...list, created]);
        return created;
    }

    async renameList(listId: string, title: string): Promise<string | null> {
        const l = this.list(listId);
        if (!l || !title.trim() || title.trim() === l.title) return null;
        const old = l.title;
        this.patchList(listId, { title: title.trim() });
        try {
            const updated = await firstValueFrom(this.taskService.update(listId, updatePayload(l, { title: title.trim() })));
            this.patchList(listId, updated);
            return null;
        } catch (err) {
            this.patchList(listId, { title: old });
            return permissionError(err, 'Không đổi được tên đầu việc.');
        }
    }

    /** Xóa cột — BE chặn khi còn việc nhỏ, FE kiểm tra trước để báo rõ. */
    async removeList(listId: string): Promise<string | null> {
        if (this.cards().some((c) => c.parentId === listId)) {
            return 'Đầu việc còn việc nhỏ. Hãy xóa hoặc chuyển các việc nhỏ sang cột khác trước.';
        }
        try {
            await firstValueFrom(this.taskService.remove(listId));
            this.lists.update((list) => list.filter((l) => l.id !== listId));
            return null;
        } catch (err) {
            return permissionError(err, 'Xóa đầu việc thất bại.');
        }
    }

    patchList(listId: string, patch: Partial<TaskListItem>): void {
        this.lists.update((list) => list.map((l) => (l.id === listId ? { ...l, ...patch } : l)));
    }

    // ── Thẻ (Việc nhỏ) ─────────────────────────────

    async addCard(listId: string, title: string): Promise<TaskListItem> {
        const parent = this.list(listId);
        if (!parent) throw new Error('Không tìm thấy đầu việc.');
        const created = await firstValueFrom(this.taskService.create(this.createPayload(parent, 2, title)));
        this.cards.update((list) => [...list, created]);
        return created;
    }

    /**
     * Chuyển thẻ sang cột khác: cập nhật UI ngay, PUT parentId,
     * lỗi thì trả thẻ về chỗ cũ. Trả về null khi thành công, ngược lại là thông báo lỗi.
     */
    async moveCard(cardId: string, toListId: string): Promise<string | null> {
        const card = this.card(cardId);
        if (!card || card.parentId === toListId || this.isPending(cardId)) return null;
        if (!card.canEdit) return 'Bạn không có quyền chuyển việc nhỏ này.';
        const from = card.parentId;
        this.patchCard(cardId, { parentId: toListId });
        this.setPending(cardId, true);
        try {
            const updated = await firstValueFrom(this.taskService.update(cardId, updatePayload(card, { parentId: toListId })));
            this.patchCard(cardId, updated);
            return null;
        } catch (err) {
            this.patchCard(cardId, { parentId: from });
            return permissionError(err, 'Không chuyển được việc nhỏ.');
        } finally {
            this.setPending(cardId, false);
        }
    }

    /** Đổi trạng thái thẻ (tick hoàn thành / chọn trạng thái) — optimistic + rollback. */
    async setCardStatus(cardId: string, status: TaskStatus): Promise<string | null> {
        const card = this.card(cardId);
        if (!card || card.status === status || this.isPending(cardId)) return null;
        if (!card.canEdit) return 'Bạn không có quyền đổi trạng thái việc nhỏ này.';
        const from = card.status;
        this.patchCard(cardId, { status });
        this.setPending(cardId, true);
        try {
            const updated = await firstValueFrom(this.taskService.updateStatus(cardId, status));
            this.patchCard(cardId, updated);
            return null;
        } catch (err) {
            this.patchCard(cardId, { status: from });
            return permissionError(err, 'Không cập nhật được trạng thái.');
        } finally {
            this.setPending(cardId, false);
        }
    }

    /** Tải lại đúng một thẻ (sau khi sửa ở drawer / sự kiện realtime). */
    async refreshCard(cardId: string): Promise<void> {
        try {
            const item = toListItem(await firstValueFrom(this.taskService.get(cardId)));
            if (item.level !== 2 || !this.list(item.parentId ?? '')) {
                this.removeCard(cardId); // đã rời khỏi bảng
                return;
            }
            if (this.card(cardId)) this.patchCard(cardId, item);
            else this.cards.update((list) => [...list, item]);
        } catch {
            this.removeCard(cardId);
        }
    }

    patchCard(cardId: string, patch: Partial<TaskListItem>): void {
        this.cards.update((list) => list.map((c) => (c.id === cardId ? { ...c, ...patch } : c)));
    }

    removeCard(cardId: string): void {
        this.cards.update((list) => list.filter((c) => c.id !== cardId));
    }

    private createPayload(parent: TaskListItem, level: number, title: string): CreateTaskRequest {
        return {
            meetingId: parent.meetingId,
            parentId: parent.id,
            level,
            title: title.trim(),
            description: null,
            assigneeUserName: null,
            dueDate: null,
            status: TaskStatus.NotStarted,
            priority: TaskPriority.Medium,
            // Thừa hưởng phạm vi của cấp cha để người xem bảng thấy được.
            isPublic: parent.isPublic,
        };
    }

    private setPending(id: string, on: boolean): void {
        this.pending.update((s) => {
            const next = new Set(s);
            if (on) next.add(id);
            else next.delete(id);
            return next;
        });
    }
}

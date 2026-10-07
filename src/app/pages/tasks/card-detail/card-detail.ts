import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, effect, ElementRef, inject, input, output, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { debounceTime, distinctUntilChanged, firstValueFrom, of, Subject, switchMap } from 'rxjs';
import { UserSearchItem } from '../../../core/models/meeting.models';
import {
    TaskDetail,
    TaskListItem,
    TaskPriority,
    TaskStatus,
    UpdateTaskRequest,
} from '../../../core/models/task.models';
import { AuthService } from '../../../core/services/auth.service';
import { MeetingService } from '../../../core/services/meeting.service';
import { classifyBoardError, TaskBoardStore } from '../../../core/services/task-board.store';
import { TaskService } from '../../../core/services/task.service';
import { SelectA11yDirective } from '../../../shared/a11y/select-a11y.directive';
import { Avatar } from '../../../shared/ui/avatar/avatar';
import { friendlyError } from '../../../shared/utils/friendly-error';
import { dueClass } from '../../../shared/utils/task-format';
import { SubtaskRow } from './subtask-row/subtask-row';

function updatePayload(t: TaskListItem, patch: Partial<UpdateTaskRequest> = {}): UpdateTaskRequest {
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

// =====================================================
// CardDetail — drawer Chi tiết đầu việc (level 1), 720px,
// full-screen trên mobile. URL /tasks/:workId/cards/:cardId.
// Trái: mô tả + checklist Việc nhỏ (level 2) + hoạt động.
// Phải: phụ trách, hạn, ưu tiên, chuyển cột, cuộc họp, xóa.
// =====================================================
@Component({
    selector: 'app-card-detail',
    templateUrl: './card-detail.html',
    styleUrl: './card-detail.scss',
    imports: [
        Avatar,
        CommonModule,
        FormsModule,
        NzButtonModule,
        NzDatePickerModule,
        NzDrawerModule,
        NzEmptyModule,
        NzIconModule,
        NzInputModule,
        NzModalModule,
        NzSelectModule,
        NzSpinModule,
        RouterLink,
        SelectA11yDirective,
        SubtaskRow,
    ],
})
export class CardDetail {
    protected readonly store = inject(TaskBoardStore);
    private readonly taskService = inject(TaskService);
    private readonly meetingService = inject(MeetingService);
    private readonly auth = inject(AuthService);
    private readonly message = inject(NzMessageService);
    private readonly destroyRef = inject(DestroyRef);

    readonly cardId = input.required<string>();
    readonly closed = output<void>();
    readonly changed = output<string>();
    readonly deleted = output<string>();
    readonly moved = output<{ card: TaskListItem; toStatus: TaskStatus }>();

    readonly TaskStatus = TaskStatus;
    readonly priorityOptions = [
        { value: TaskPriority.Low, label: 'Thấp' },
        { value: TaskPriority.Medium, label: 'Trung bình' },
        { value: TaskPriority.High, label: 'Cao' },
    ];

    protected readonly task = signal<TaskDetail | null>(null);
    protected readonly subtasks = signal<TaskListItem[]>([]);
    protected readonly loading = signal(false);
    protected readonly loadError = signal<string | null>(null);
    protected readonly saving = signal(false);
    protected readonly pendingSubs = signal<ReadonlySet<string>>(new Set());

    // Mô tả / tiêu đề sửa tại chỗ
    protected readonly editingTitle = signal(false);
    protected readonly titleDraft = signal('');
    protected readonly editingDesc = signal(false);
    protected readonly descDraft = signal('');
    private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

    // Thêm nhanh việc nhỏ
    protected readonly newSubTitle = signal('');
    protected readonly addingSub = signal(false);

    protected readonly deleteOpen = signal(false);
    protected readonly deleting = signal(false);

    /** Trạng thái lấy từ store khi thẻ có trên bảng — kéo thả ở bảng phản ánh ngay vào drawer. */
    protected readonly status = computed(() => this.store.card(this.cardId())?.status ?? this.task()?.status ?? TaskStatus.NotStarted);
    protected readonly statusPending = computed(() => this.store.pending().has(this.cardId()));
    protected readonly doneCount = computed(() => this.subtasks().filter((s) => s.status === TaskStatus.Completed).length);
    protected readonly percent = computed(() => {
        const total = this.subtasks().length;
        return total ? Math.round((this.doneCount() / total) * 100) : 0;
    });
    /** Gợi ý (không tự động) chuyển đầu việc sang Hoàn thành khi mọi việc nhỏ đã xong. */
    protected readonly suggestComplete = computed(
        () =>
            !!this.task()?.canEdit &&
            this.subtasks().length > 0 &&
            this.doneCount() === this.subtasks().length &&
            this.status() !== TaskStatus.Completed
    );
    protected readonly dueTone = computed(() => {
        const t = this.task();
        return t ? dueClass(t.dueDate, this.status()) : '';
    });
    protected readonly dueValue = computed(() => (this.task()?.dueDate ? new Date(this.task()!.dueDate!) : null));

    // Người phụ trách đầu việc (server search)
    private readonly userSearch$ = new Subject<string>();
    private readonly searchedUsers = signal<UserSearchItem[]>([]);
    protected readonly searchingUsers = signal(false);
    protected readonly assigneeOptions = computed<UserSearchItem[]>(() => {
        const map = new Map<string, UserSearchItem>();
        const me = this.auth.currentUser();
        if (me) map.set(me.userName, { userName: me.userName, fullName: me.fullName || me.userName, email: me.email ?? '' });
        const t = this.task();
        if (t?.assigneeUserName) {
            map.set(t.assigneeUserName, { userName: t.assigneeUserName, fullName: t.assigneeFullName || t.assigneeUserName, email: '' });
        }
        for (const u of this.searchedUsers()) map.set(u.userName, u);
        return [...map.values()];
    });

    constructor() {
        effect(() => {
            const id = this.cardId();
            if (id) void this.load(id);
        });

        this.userSearch$
            .pipe(
                debounceTime(300),
                distinctUntilChanged(),
                switchMap((q) => {
                    if (!q.trim()) return of([] as UserSearchItem[]);
                    this.searchingUsers.set(true);
                    return this.meetingService.searchUsers(q);
                }),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe({
                next: (users) => {
                    this.searchingUsers.set(false);
                    this.searchedUsers.set(users);
                },
                error: () => this.searchingUsers.set(false),
            });
    }

    async load(id = this.cardId()): Promise<void> {
        this.loading.set(true);
        this.loadError.set(null);
        try {
            const detail = await firstValueFrom(this.taskService.get(id));
            if (id !== this.cardId()) return;
            if (detail.level !== 1 || detail.parentId !== this.store.workId()) {
                this.loadError.set('Đầu việc này không thuộc bảng đang mở.');
                return;
            }
            this.task.set(detail);
            this.subtasks.set(detail.children ?? []);
        } catch (err) {
            if (id === this.cardId()) this.loadError.set(classifyBoardError(err).message.replace('Công việc', 'Đầu việc'));
        } finally {
            if (id === this.cardId()) this.loading.set(false);
        }
    }

    close(): void {
        if (this.deleting()) return;
        this.closed.emit();
    }

    // ── Đầu việc ───────────────────────────────────

    private async saveCard(patch: Partial<UpdateTaskRequest>, okMessage?: string): Promise<boolean> {
        const t = this.task();
        if (!t || !t.canEdit || this.saving()) return false;
        this.saving.set(true);
        try {
            // status lấy theo store để PUT không ghi đè trạng thái vừa kéo thả.
            const updated = await firstValueFrom(this.taskService.update(t.id, updatePayload({ ...t, status: this.status() }, patch)));
            this.task.update((cur) => (cur ? { ...cur, ...updated } : cur));
            this.store.patchCard(t.id, updated);
            this.changed.emit(t.id);
            if (okMessage) this.message.success(okMessage);
            return true;
        } catch (err) {
            this.message.error(friendlyError(err, 'Cập nhật đầu việc thất bại.'));
            return false;
        } finally {
            this.saving.set(false);
        }
    }

    protected startTitleEdit(): void {
        const t = this.task();
        if (!t?.canEdit) return;
        this.titleDraft.set(t.title);
        this.editingTitle.set(true);
        setTimeout(() => this.titleInput()?.nativeElement.select());
    }

    protected async commitTitle(): Promise<void> {
        if (!this.editingTitle()) return;
        this.editingTitle.set(false);
        const title = this.titleDraft().trim();
        if (title && title !== this.task()?.title) await this.saveCard({ title });
    }

    protected startDescEdit(): void {
        this.descDraft.set(this.task()?.description ?? '');
        this.editingDesc.set(true);
    }

    protected async saveDesc(): Promise<void> {
        const description = this.descDraft().trim() || null;
        if (description === (this.task()?.description ?? null)) {
            this.editingDesc.set(false);
            return;
        }
        if (await this.saveCard({ description })) this.editingDesc.set(false);
    }

    protected onAssigneeSearch(q: string): void {
        this.userSearch$.next(q);
    }

    protected onAssignee(userName: string | null): void {
        if ((userName || null) === this.task()?.assigneeUserName) return;
        void this.saveCard({ assigneeUserName: userName || null });
    }

    protected onDue(date: Date | null): void {
        const cur = this.task()?.dueDate ? new Date(this.task()!.dueDate!).getTime() : null;
        if ((date?.getTime() ?? null) === cur) return;
        void this.saveCard({ dueDate: date ? date.toISOString() : null });
    }

    protected onPriority(priority: TaskPriority): void {
        if (priority === this.task()?.priority) return;
        void this.saveCard({ priority });
    }

    protected onStatus(toStatus: TaskStatus): void {
        const t = this.task();
        if (!t || toStatus === this.status()) return;
        this.moved.emit({ card: this.store.card(t.id) ?? t, toStatus });
    }

    protected openDelete(): void {
        this.deleteOpen.set(true);
    }

    protected async confirmDelete(): Promise<void> {
        const t = this.task();
        if (!t || this.deleting()) return;
        this.deleting.set(true);
        try {
            await firstValueFrom(this.taskService.remove(t.id));
            this.deleteOpen.set(false);
            this.message.success('Đã xóa đầu việc.');
            this.deleted.emit(t.id);
        } catch (err) {
            this.message.error(friendlyError(err, 'Xóa đầu việc thất bại.'));
        } finally {
            this.deleting.set(false);
        }
    }

    // ── Việc nhỏ ───────────────────────────────────

    private syncCounts(): void {
        const t = this.task();
        if (!t) return;
        const patch = { childrenCount: this.subtasks().length, completedChildrenCount: this.doneCount() };
        this.task.update((cur) => (cur ? { ...cur, ...patch } : cur));
        this.store.patchCard(t.id, patch);
    }

    private setSubPending(id: string, on: boolean): void {
        this.pendingSubs.update((s) => {
            const next = new Set(s);
            if (on) next.add(id);
            else next.delete(id);
            return next;
        });
    }

    private patchSub(id: string, patch: Partial<TaskListItem>): void {
        this.subtasks.update((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    }

    async toggleSubtask(sub: TaskListItem, checked: boolean): Promise<void> {
        const from = sub.status;
        const to = checked ? TaskStatus.Completed : TaskStatus.NotStarted;
        if (from === to || this.pendingSubs().has(sub.id)) return;
        this.patchSub(sub.id, { status: to });
        this.syncCounts();
        this.setSubPending(sub.id, true);
        try {
            const updated = await firstValueFrom(this.taskService.updateStatus(sub.id, to));
            this.patchSub(sub.id, updated);
        } catch (err) {
            this.patchSub(sub.id, { status: from });
            this.syncCounts();
            this.message.error(friendlyError(err, 'Không cập nhật được việc nhỏ.'));
        } finally {
            this.setSubPending(sub.id, false);
        }
    }

    protected async updateSubtask(sub: TaskListItem, patch: Partial<UpdateTaskRequest>): Promise<void> {
        if (this.pendingSubs().has(sub.id)) return;
        this.setSubPending(sub.id, true);
        try {
            const updated = await firstValueFrom(this.taskService.update(sub.id, updatePayload(sub, patch)));
            this.patchSub(sub.id, updated);
        } catch (err) {
            this.message.error(friendlyError(err, 'Không cập nhật được việc nhỏ.'));
        } finally {
            this.setSubPending(sub.id, false);
        }
    }

    protected onSubDue(sub: TaskListItem, date: Date | null): void {
        void this.updateSubtask(sub, { dueDate: date ? date.toISOString() : null });
    }

    protected async removeSubtask(sub: TaskListItem): Promise<void> {
        this.setSubPending(sub.id, true);
        try {
            await firstValueFrom(this.taskService.remove(sub.id));
            this.subtasks.update((list) => list.filter((s) => s.id !== sub.id));
            this.syncCounts();
        } catch (err) {
            this.message.error(friendlyError(err, 'Xóa việc nhỏ thất bại.'));
        } finally {
            this.setSubPending(sub.id, false);
        }
    }

    async addSubtask(): Promise<void> {
        const t = this.task();
        const title = this.newSubTitle().trim();
        if (!t || !title || this.addingSub()) return;
        this.addingSub.set(true);
        try {
            const created = await firstValueFrom(
                this.taskService.create({
                    meetingId: t.meetingId,
                    parentId: t.id,
                    level: 2,
                    title,
                    description: null,
                    assigneeUserName: null,
                    dueDate: null,
                    status: TaskStatus.NotStarted,
                    priority: TaskPriority.Medium,
                    isPublic: t.isPublic,
                })
            );
            this.subtasks.update((list) => [...list, created]);
            this.syncCounts();
            this.newSubTitle.set('');
        } catch (err) {
            this.message.error(friendlyError(err, 'Không thêm được việc nhỏ.'));
        } finally {
            this.addingSub.set(false);
        }
    }

    // ── Hiển thị ───────────────────────────────────

    protected formatDateTime(iso: string | null | undefined): string {
        if (!iso) return '—';
        const d = new Date(iso);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        return `${day}/${month}/${d.getFullYear()} · ${time}`;
    }
}

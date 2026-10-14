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
import { NzSelectModule } from 'ng-zorro-antd/select';
import { debounceTime, distinctUntilChanged, firstValueFrom, of, Subject, switchMap } from 'rxjs';
import { UserSearchItem } from '../../../core/models/meeting.models';
import { TaskDetail, TaskListItem, TaskPriority, TaskStatus, UpdateTaskRequest } from '../../../core/models/task.models';
import { AuthService } from '../../../core/services/auth.service';
import { MeetingService } from '../../../core/services/meeting.service';
import { classifyBoardError, TaskBoardStore, updatePayload } from '../../../core/services/task-board.store';
import { TaskService } from '../../../core/services/task.service';
import { SelectA11yDirective } from '../../../shared/a11y/select-a11y.directive';
import { Avatar } from '../../../shared/ui/avatar/avatar';
import { friendlyError } from '../../../shared/utils/friendly-error';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog';
import { HeaderAction, HeaderActions } from '../../../shared/ui/header-actions/header-actions';
import { taskStatus } from '../../../shared/utils/status-map';
import { dueClass } from '../../../shared/utils/task-format';

// =====================================================
// CardDetail — drawer chi tiết một Việc nhỏ (level 2), 720px,
// full-screen trên mobile. URL /tasks/:workId/cards/:cardId.
// Trái: mô tả + hoạt động. Phải: đầu việc (cột), trạng thái,
// phụ trách, hạn, ưu tiên, cuộc họp, xóa.
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
        HeaderActions,
        NzSelectModule,
        RouterLink,
        SelectA11yDirective,
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
    readonly moved = output<{ card: TaskListItem; toListId: string }>();

    readonly statusOptions = [TaskStatus.NotStarted, TaskStatus.InProgress, TaskStatus.Completed].map((value) => ({
        value,
        label: taskStatus(value).label,
    }));
    readonly priorityOptions = [
        { value: TaskPriority.Low, label: 'Thấp' },
        { value: TaskPriority.Medium, label: 'Trung bình' },
        { value: TaskPriority.High, label: 'Cao' },
    ];

    protected readonly task = signal<TaskDetail | null>(null);
    protected readonly loading = signal(false);
    protected readonly loadError = signal<string | null>(null);
    protected readonly saving = signal(false);

    // Tiêu đề / mô tả sửa tại chỗ
    protected readonly editingTitle = signal(false);
    protected readonly titleDraft = signal('');
    protected readonly editingDesc = signal(false);
    protected readonly descDraft = signal('');
    private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

    protected readonly deleting = signal(false);
    private readonly dialog = inject(ConfirmDialogService);
    /** Đã lưu ít nhất 1 thay đổi trong phiên mở drawer — để hiện "Đã lưu". */
    private readonly savedOnce = signal(false);

    // ── Header (Plan_GiaoDien_Drawer.md): mỗi trường lưu ngay → chỉ báo trạng thái, Xóa trong ⋯ ──
    protected readonly saveStatus = computed(() =>
        this.saving() || this.pending() ? 'Đang lưu…' : this.savedOnce() ? 'Đã lưu' : null
    );
    protected readonly headerActions = computed<HeaderAction[]>(() => {
        const t = this.task();
        if (!t) return [];
        return [
            { label: 'Xóa việc nhỏ', icon: 'delete', danger: true, overflow: true, hidden: !t.isCreator, run: () => this.openDelete() },
        ];
    });

    /** Bản trên bảng (store) là nguồn cho trạng thái + cột — kéo thả / tick ở bảng phản ánh ngay vào drawer. */
    private readonly boardCard = computed(() => this.store.card(this.cardId()));
    protected readonly status = computed(() => this.boardCard()?.status ?? this.task()?.status ?? TaskStatus.NotStarted);
    protected readonly listId = computed(() => this.boardCard()?.parentId ?? this.task()?.parentId ?? null);
    protected readonly listTitle = computed(() => this.store.list(this.listId() ?? '')?.title ?? '');
    protected readonly pending = computed(() => this.store.pending().has(this.cardId()));
    protected readonly dueTone = computed(() => {
        const t = this.task();
        return t ? dueClass(t.dueDate, this.status()) : '';
    });
    protected readonly dueValue = computed(() => (this.task()?.dueDate ? new Date(this.task()!.dueDate!) : null));

    // Người phụ trách (server search)
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
            if (detail.level !== 2 || !this.store.list(detail.parentId ?? '')) {
                this.loadError.set('Việc nhỏ này không thuộc bảng đang mở.');
                return;
            }
            this.task.set(detail);
        } catch (err) {
            if (id === this.cardId()) this.loadError.set(classifyBoardError(err).message.replace('Công việc', 'Việc nhỏ'));
        } finally {
            if (id === this.cardId()) this.loading.set(false);
        }
    }

    close(): void {
        if (this.deleting()) return;
        this.closed.emit();
    }

    // ── Sửa ────────────────────────────────────────

    private async save(patch: Partial<UpdateTaskRequest>): Promise<boolean> {
        const t = this.task();
        if (!t || !t.canEdit || this.saving()) return false;
        this.saving.set(true);
        try {
            // status theo store để PUT không ghi đè thao tác vừa làm trên bảng; không gửi parentId → không đổi cột.
            const base = { ...t, status: this.status() };
            const updated = await firstValueFrom(this.taskService.update(t.id, updatePayload(base, patch)));
            this.task.update((cur) => (cur ? { ...cur, ...updated } : cur));
            this.store.patchCard(t.id, updated);
            this.changed.emit(t.id);
            this.savedOnce.set(true);
            return true;
        } catch (err) {
            this.message.error(friendlyError(err, 'Cập nhật việc nhỏ thất bại.'));
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
        if (title && title !== this.task()?.title) await this.save({ title });
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
        if (await this.save({ description })) this.editingDesc.set(false);
    }

    protected onAssigneeSearch(q: string): void {
        this.userSearch$.next(q);
    }

    protected onAssignee(userName: string | null): void {
        if ((userName || null) === this.task()?.assigneeUserName) return;
        void this.save({ assigneeUserName: userName || null });
    }

    protected onDue(date: Date | null): void {
        const cur = this.task()?.dueDate ? new Date(this.task()!.dueDate!).getTime() : null;
        if ((date?.getTime() ?? null) === cur) return;
        void this.save({ dueDate: date ? date.toISOString() : null });
    }

    protected onPriority(priority: TaskPriority): void {
        if (priority === this.task()?.priority) return;
        void this.save({ priority });
    }

    protected async onStatus(status: TaskStatus): Promise<void> {
        const error = await this.store.setCardStatus(this.cardId(), status);
        if (error) this.message.error(error);
        else {
            this.task.update((cur) => (cur ? { ...cur, status } : cur));
            this.savedOnce.set(true);
        }
    }

    protected onList(toListId: string): void {
        const t = this.task();
        if (!t || toListId === this.listId()) return;
        this.moved.emit({ card: this.boardCard() ?? t, toListId });
    }

    protected openDelete(): void {
        const t = this.task();
        if (!t) return;
        void this.dialog.open({
            title: 'Xóa việc nhỏ?',
            content: `“${t.title}” sẽ bị xóa. Hành động này không thể hoàn tác.`,
            okText: 'Xóa',
            danger: true,
            onOk: () => this.confirmDelete(t),
        });
    }

    private async confirmDelete(t: TaskDetail): Promise<void> {
        this.deleting.set(true);
        try {
            await firstValueFrom(this.taskService.remove(t.id));
            this.message.success('Đã xóa việc nhỏ.');
            this.deleted.emit(t.id);
        } catch (err) {
            this.message.error(friendlyError(err, 'Xóa việc nhỏ thất bại.'));
            throw err;
        } finally {
            this.deleting.set(false);
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

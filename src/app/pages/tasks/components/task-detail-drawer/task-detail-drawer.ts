import { Component, computed, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { MeetingService } from '../../../../core/services/meeting.service';
import { TaskService } from '../../../../core/services/task.service';
import {
    TaskDetail,
    TaskListItem,
    TaskPriority,
    TaskShare,
    TaskSharePermission,
    TaskStatus,
    UpdateTaskRequest,
} from '../../../../core/models/task.models';
import { UserSearchItem } from '../../../../core/models/meeting.models';
import { TaskCreateModal } from '../task-create-modal/task-create-modal';

// =====================================================
// TaskDetailDrawer — chi tiết công việc (nz-drawer 480px,
// <768 fullscreen). 2 mode Xem/Sửa + phần "Chia sẻ &
// Quyền" (chỉ creator): public, share list, thêm share.
// =====================================================
@Component({
    selector: 'app-task-detail-drawer',
    templateUrl: './task-detail-drawer.html',
    styleUrl: './task-detail-drawer.scss',
    imports: [
        CommonModule,
        RouterLink,
        FormsModule,
        ReactiveFormsModule,
        NzDrawerModule,
        NzButtonModule,
        NzEmptyModule,
        NzIconModule,
        NzInputModule,
        NzModalModule,
        NzSelectModule,
        NzSpinModule,
        NzSwitchModule,
        NzDatePickerModule,
        NzTooltipModule,
        TaskCreateModal,
    ],
})
export class TaskDetailDrawer {
    private readonly fb = inject(FormBuilder);
    private readonly taskService = inject(TaskService);
    private readonly meetingService = inject(MeetingService);
    private readonly auth = inject(AuthService);
    private readonly message = inject(NzMessageService);
    private readonly destroyRef = inject(DestroyRef);

    open = input<boolean>(false);
    taskId = input<string | null>(null);
    closed = output<void>();
    changed = output<void>(); // tạo/sửa/xóa/share → list reload

    readonly TaskStatus = TaskStatus;
    readonly TaskPriority = TaskPriority;
    readonly TaskSharePermission = TaskSharePermission;

    readonly statusOptions = [
        { value: TaskStatus.NotStarted, label: 'Chưa bắt đầu' },
        { value: TaskStatus.InProgress, label: 'Đang làm' },
        { value: TaskStatus.Completed, label: 'Hoàn thành' },
    ];

    readonly priorityOptions = [
        { value: TaskPriority.Low, label: 'Thấp' },
        { value: TaskPriority.Medium, label: 'Trung bình' },
        { value: TaskPriority.High, label: 'Cao' },
    ];

    readonly permissionOptions = [
        { value: TaskSharePermission.View, label: 'Xem' },
        { value: TaskSharePermission.Edit, label: 'Sửa' },
    ];

    task = signal<TaskDetail | null>(null);
    loading = signal(false);
    loadError = signal<string | null>(null);
    editing = signal(false);
    saving = signal(false);
    submitError = signal<string | null>(null);

    // Share state (creator only)
    publicToggling = signal(false);
    addShareUserName = signal<string | null>(null);
    addSharePermission = signal<TaskSharePermission>(TaskSharePermission.View);
    addShareSaving = signal(false);
    addShareError = signal<string | null>(null);
    removingShareUser = signal<string | null>(null);

    // Xóa task
    deleteOpen = signal(false);
    deleteSaving = signal(false);

    // Tạo con (SubWork / Task)
    subCreateOpen = signal(false);
    subCreateParentId = signal<string | null>(null);
    subCreateParentTitle = signal<string | null>(null);

    readonly editForm = this.fb.group({
        title: ['', [Validators.required, Validators.maxLength(300)]],
        description: ['', [Validators.maxLength(4000)]],
        assigneeUserName: [null as string | null],
        dueDate: [null as Date | null],
        status: [TaskStatus.NotStarted as TaskStatus],
        priority: [TaskPriority.Medium as TaskPriority],
    });

    // ── Người phụ trách search (User/Search debounce 300ms) ──
    private readonly userSearch$ = new Subject<string>();
    private readonly knownUsers = signal(new Map<string, UserSearchItem>());
    readonly searchedUsers = signal<UserSearchItem[]>([]);
    readonly searchingUsers = signal(false);

    readonly meOption = computed<UserSearchItem | null>(() => {
        const me = this.auth.currentUser();
        return me ? { userName: me.userName, fullName: me.fullName || me.userName, email: me.email ?? '' } : null;
    });

    readonly assigneeOptions = computed<UserSearchItem[]>(() => {
        const map = new Map<string, UserSearchItem>();
        const me = this.meOption();
        if (me) map.set(me.userName, me);
        for (const u of this.searchedUsers()) map.set(u.userName, u);
        const selected = this.editForm.controls.assigneeUserName.value;
        if (selected && !map.has(selected)) {
            const known = this.knownUsers().get(selected);
            map.set(selected, known ?? { userName: selected, fullName: selected, email: '' });
        }
        return [...map.values()];
    });

    // Người share cần search riêng (có thể khác assignee)
    private readonly shareUserSearch$ = new Subject<string>();
    readonly shareUserOptions = signal<UserSearchItem[]>([]);

    constructor() {
        this.userSearch$
            .pipe(
                debounceTime(300),
                distinctUntilChanged(),
                switchMap((q) => {
                    if (!q.trim()) {
                        this.searchingUsers.set(false);
                        return [];
                    }
                    this.searchingUsers.set(true);
                    return this.meetingService.searchUsers(q);
                }),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe({
                next: (users) => {
                    this.searchingUsers.set(false);
                    this.searchedUsers.set(users);
                    this.rememberUsers(users);
                },
                error: () => this.searchingUsers.set(false),
            });

        this.shareUserSearch$
            .pipe(
                debounceTime(300),
                distinctUntilChanged(),
                switchMap((q) => {
                    if (!q.trim()) return [];
                    return this.meetingService.searchUsers(q);
                }),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe({
                next: (users) => {
                    this.shareUserOptions.set(users);
                    this.rememberUsers(users);
                },
                error: () => this.shareUserOptions.set([]),
            });

        // Load khi mở drawer / đổi taskId
        effect(() => {
            if (this.open() && this.taskId()) this.load();
            if (!this.open()) {
                this.editing.set(false);
                this.submitError.set(null);
                this.addShareError.set(null);
            }
        });
    }

    private rememberUsers(users: UserSearchItem[]): void {
        if (users.length === 0) return;
        this.knownUsers.update((m) => {
            const next = new Map(m);
            for (const u of users) next.set(u.userName, u);
            return next;
        });
    }

    load(): void {
        const id = this.taskId();
        if (!id) return;
        this.loading.set(true);
        this.loadError.set(null);
        this.taskService
            .get(id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (detail) => {
                    this.task.set(detail);
                    this.loading.set(false);
                },
                error: (err: Error) => {
                    this.loading.set(false);
                    this.loadError.set(err.message || 'Không tải được chi tiết công việc.');
                },
            });
    }

    close(): void {
        if (this.saving() || this.deleteSaving()) return;
        this.closed.emit();
    }

    // ── Sửa ────────────────────────────────────────

    startEdit(): void {
        const t = this.task();
        if (!t?.canEdit) return;
        this.submitError.set(null);
        const known = t.assigneeUserName
            ? { userName: t.assigneeUserName, fullName: t.assigneeFullName || t.assigneeUserName, email: '' }
            : null;
        if (known && t.assigneeUserName) {
            this.knownUsers.update((m) => {
                const next = new Map(m);
                next.set(known.userName, known);
                return next;
            });
        }
        this.editForm.reset({
            title: t.title,
            description: t.description ?? '',
            assigneeUserName: t.assigneeUserName,
            dueDate: t.dueDate ? new Date(t.dueDate) : null,
            status: t.status,
            priority: t.priority,
        });
        this.searchedUsers.set([]);
        this.editing.set(true);
    }

    cancelEdit(): void {
        this.editing.set(false);
        this.submitError.set(null);
    }

    saveEdit(): void {
        const t = this.task();
        if (!t || this.saving()) return;
        this.submitError.set(null);
        if (this.editForm.invalid) {
            this.editForm.markAllAsTouched();
            return;
        }
        const v = this.editForm.getRawValue();
        const payload: UpdateTaskRequest = {
            title: v.title!.trim(),
            description: v.description?.trim() || null,
            assigneeUserName: v.assigneeUserName || null,
            dueDate: v.dueDate ? (v.dueDate as Date).toISOString() : null,
            status: v.status ?? TaskStatus.NotStarted,
            priority: v.priority ?? TaskPriority.Medium,
        };
        this.saving.set(true);
        this.taskService
            .update(t.id, payload)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.saving.set(false);
                    this.editing.set(false);
                    this.message.success('Cập nhật công việc thành công.');
                    this.load();
                    this.changed.emit();
                },
                error: (err: Error) => {
                    this.saving.set(false);
                    this.submitError.set(err.message || 'Cập nhật công việc thất bại.');
                },
            });
    }

    onAssigneeSearch(q: string): void {
        this.userSearch$.next(q);
    }

    // ── Chia sẻ & quyền (creator only) ────────────

    togglePublic(isPublic: boolean): void {
        const t = this.task();
        if (!t || this.publicToggling()) return;
        this.publicToggling.set(true);
        this.taskService
            .setVisibility(t.id, isPublic)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.publicToggling.set(false);
                    this.task.update((cur) => (cur ? { ...cur, isPublic } : cur));
                    this.message.success(isPublic ? 'Đã công khai công việc.' : 'Đã chuyển sang riêng tư.');
                },
                error: (err: Error) => {
                    this.publicToggling.set(false);
                    // Server từ chối → giữ nguyên giá trị cũ (signal chưa đổi nên không cần rollback)
                    this.message.error(err.message || 'Không cập nhật được quyền công khai.');
                },
            });
    }

    onShareUserSearch(q: string): void {
        this.shareUserSearch$.next(q);
    }

    onShareUserChange(userName: string | null): void {
        this.addShareUserName.set(userName);
        this.addShareError.set(null);
    }

    onSharePermissionChange(permission: TaskSharePermission): void {
        this.addSharePermission.set(permission);
    }

    addShareSubmit(): void {
        const t = this.task();
        const userName = this.addShareUserName();
        if (!t || !userName || this.addShareSaving()) return;
        this.addShareError.set(null);
        this.addShareSaving.set(true);
        this.taskService
            .addShare(t.id, { userName, permission: this.addSharePermission() })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (detail) => {
                    this.addShareSaving.set(false);
                    this.addShareUserName.set(null);
                    this.shareUserOptions.set([]);
                    this.task.set(detail);
                    this.message.success('Đã chia sẻ công việc.');
                },
                error: (err: Error) => {
                    this.addShareSaving.set(false);
                    this.addShareError.set(err.message || 'Chia sẻ công việc thất bại.');
                },
            });
    }

    removeShare(share: TaskShare): void {
        const t = this.task();
        if (!t || this.removingShareUser()) return;
        this.removingShareUser.set(share.userName);
        this.taskService
            .removeShare(t.id, share.userName)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.removingShareUser.set(null);
                    this.task.update((cur) =>
                        cur
                            ? { ...cur, shares: (cur.shares ?? []).filter((s) => s.userName !== share.userName) }
                            : cur
                    );
                    this.message.success('Đã xóa người được chia sẻ.');
                },
                error: (err: Error) => {
                    this.removingShareUser.set(null);
                    this.message.error(err.message || 'Xóa người được chia sẻ thất bại.');
                },
            });
    }

    // ── Xóa task (creator only) ────────────────────

    openSubCreate(parent: TaskListItem | TaskDetail): void {
        if (parent.level >= 2) {
            this.message.warning('Đã ở cấp sâu nhất, không thể tạo thêm con.');
            return;
        }
        this.subCreateParentId.set(parent.id);
        this.subCreateParentTitle.set(parent.title);
        this.subCreateOpen.set(true);
    }
    closeSubCreate(): void {
        this.subCreateOpen.set(false);
        this.subCreateParentId.set(null);
        this.subCreateParentTitle.set(null);
    }
    onSubCreated(): void {
        this.closeSubCreate();
        this.message.success('Đã tạo công việc con.');
        this.load();
        this.changed.emit();
    }

    levelLabel(level: number): string {
        return level === 0 ? 'Công việc' : level === 1 ? 'Công việc nhỏ' : 'Task';
    }

    openDelete(): void {
        this.deleteOpen.set(true);
    }

    closeDelete(): void {
        if (this.deleteSaving()) return;
        this.deleteOpen.set(false);
    }

    confirmDelete(): void {
        const t = this.task();
        if (!t || this.deleteSaving()) return;
        this.deleteSaving.set(true);
        this.taskService
            .remove(t.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.deleteSaving.set(false);
                    this.deleteOpen.set(false);
                    this.message.success('Đã xóa công việc.');
                    this.closed.emit();
                    this.changed.emit();
                },
                error: (err: Error) => {
                    this.deleteSaving.set(false);
                    this.message.error(err.message || 'Xóa công việc thất bại.');
                },
            });
    }

    // ── Hiển thị ──

    statusLabel(status: number): string {
        const map: Record<number, string> = {
            [TaskStatus.NotStarted]: 'Chưa bắt đầu',
            [TaskStatus.InProgress]: 'Đang làm',
            [TaskStatus.Completed]: 'Hoàn thành',
        };
        return map[status] ?? 'Không xác định';
    }

    statusClass(status: number): string {
        const map: Record<number, string> = {
            [TaskStatus.NotStarted]: 'draft',
            [TaskStatus.InProgress]: 'ongoing',
            [TaskStatus.Completed]: 'ended',
        };
        return map[status] ?? 'draft';
    }

    priorityLabel(priority: number): string {
        const map: Record<number, string> = {
            [TaskPriority.Low]: 'Thấp',
            [TaskPriority.Medium]: 'Trung bình',
            [TaskPriority.High]: 'Cao',
        };
        return map[priority] ?? 'Trung bình';
    }

    dueClass(task: TaskListItem): string {
        if (!task.dueDate || task.status === TaskStatus.Completed) return '';
        const due = new Date(task.dueDate).getTime();
        const now = Date.now();
        if (due < now) return 'is-overdue';
        if (due - now <= 48 * 3600_000) return 'is-due-soon';
        return '';
    }

    formatDateTime(iso: string | null | undefined): string {
        if (!iso) return '—';
        const d = new Date(iso);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        return `${day}/${month}/${d.getFullYear()} · ${time}`;
    }

    permissionLabel(permission: number): string {
        return permission === TaskSharePermission.Edit ? 'Sửa' : 'Xem';
    }

    initials(name: string | null): string {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
}

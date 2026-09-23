import { Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';
import { AuthService } from '../../../../core/services/auth.service';
import { MeetingService } from '../../../../core/services/meeting.service';
import { TaskService } from '../../../../core/services/task.service';
import { CreateTaskRequest, TaskPriority, TaskStatus } from '../../../../core/models/task.models';
import { MeetingListItemDto } from '../../../../core/models/dashboard.models';
import { UserSearchItem } from '../../../../core/models/meeting.models';

// =====================================================
// TaskCreateModal — popup tạo công việc (nhanh, ít field).
// Field map 1:1 CreateTaskDto (POST /api/Task).
// Ngữ cảnh cuộc họp: select cuộc họp bị khóa sẵn.
// Người phụ trách: option đầu "Tôi" (User/Search loại
// trừ chính mình) + server search debounce 300ms.
// =====================================================
@Component({
    selector: 'app-task-create-modal',
    templateUrl: './task-create-modal.html',
    styleUrl: './task-create-modal.scss',
    imports: [
        ReactiveFormsModule,
        NzModalModule,
        NzInputModule,
        NzSelectModule,
        NzDatePickerModule,
        NzCheckboxModule,
        NzButtonModule,
    ],
})
export class TaskCreateModal {
    private readonly fb = inject(FormBuilder);
    private readonly taskService = inject(TaskService);
    private readonly meetingService = inject(MeetingService);
    private readonly auth = inject(AuthService);
    private readonly destroyRef = inject(DestroyRef);

    // null = standalone (/tasks); có giá trị = ngữ cảnh cuộc họp (khóa select)
    meetingId = input<string | null>(null);
    parentId = input<string | null>(null);
    parentTitle = input<string | null>(null);
    open = input<boolean>(false);
    closed = output<void>();
    created = output<void>();

    readonly TaskStatus = TaskStatus;
    readonly TaskPriority = TaskPriority;

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

    readonly form = this.fb.group({
        title: ['', [Validators.required, Validators.maxLength(300)]],
        description: ['', [Validators.maxLength(4000)]],
        meetingId: [null as string | null],
        assigneeUserName: [null as string | null],
        dueDate: [null as Date | null],
        status: [TaskStatus.NotStarted as TaskStatus],
        priority: [TaskPriority.Medium as TaskPriority],
        isPublic: [false],
    });

    readonly saving = signal(false);
    readonly submitError = signal<string | null>(null);

    // ── Cuộc họp (tùy chọn; standalone + not context) ──
    private readonly meetingSearch$ = new Subject<string>();
    readonly meetingOptions = signal<MeetingListItemDto[]>([]);
    readonly meetingLoading = signal(false);
    readonly selectedMeetingName = signal<string | null>(null);

    // ── Người phụ trách (search User/Search, debounce 300ms) ──
    private readonly userSearch$ = new Subject<string>();
    private readonly knownUsers = signal(new Map<string, UserSearchItem>());
    readonly searchedUsers = signal<UserSearchItem[]>([]);
    readonly searchingUsers = signal(false);

    // Option đầu = "Tôi" (User/Search loại trừ chính mình nên phải tự thêm)
    readonly meOption = computed<UserSearchItem | null>(() => {
        const me = this.auth.currentUser();
        return me ? { userName: me.userName, fullName: me.fullName || me.userName, email: me.email ?? '' } : null;
    });

    readonly assigneeOptions = computed<UserSearchItem[]>(() => {
        const map = new Map<string, UserSearchItem>();
        const me = this.meOption();
        if (me) map.set(me.userName, me);
        for (const u of this.searchedUsers()) map.set(u.userName, u);
        const selected = this.form.controls.assigneeUserName.value;
        if (selected) {
            if (!map.has(selected)) {
                const known = this.knownUsers().get(selected);
                map.set(selected, known ?? { userName: selected, fullName: selected, email: '' });
            }
        }
        return [...map.values()];
    });

    constructor() {
        // Search cuộc họp (chỉ khi mở từ /tasks, không khóa context)
        this.meetingSearch$
            .pipe(
                debounceTime(300),
                distinctUntilChanged(),
                switchMap((q) => {
                    this.meetingLoading.set(true);
                    return this.meetingService.query({
                        tab: 'all',
                        keyword: q.trim(),
                        status: null,
                        page: 1,
                        pageSize: 20,
                        startDate: null,
                        endDate: null,
                    });
                }),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe({
                next: (paged) => {
                    this.meetingLoading.set(false);
                    this.meetingOptions.set(paged.items ?? []);
                },
                error: () => this.meetingLoading.set(false),
            });

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
                    if (users.length > 0) {
                        this.knownUsers.update((m) => {
                            const next = new Map(m);
                            for (const u of users) next.set(u.userName, u);
                            return next;
                        });
                    }
                },
                error: () => this.searchingUsers.set(false),
            });
    }

    onMeetingSearch(q: string): void {
        this.meetingSearch$.next(q);
    }

    onUserSearch(q: string): void {
        this.userSearch$.next(q);
    }

    close(): void {
        if (this.saving()) return;
        this.submitError.set(null);
        this.closed.emit();
    }

    submit(): void {
        this.submitError.set(null);
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        const v = this.form.getRawValue();
        const meetingId = this.meetingId() ?? (v.meetingId || null);
        const parentId = this.parentId();
        const payload: CreateTaskRequest = {
            meetingId,
            parentId: parentId ?? null,
            title: v.title!.trim(),
            description: v.description?.trim() || null,
            assigneeUserName: v.assigneeUserName || null,
            dueDate: v.dueDate ? (v.dueDate as Date).toISOString() : null,
            status: v.status ?? TaskStatus.NotStarted,
            priority: v.priority ?? TaskPriority.Medium,
            isPublic: v.isPublic ?? false,
        };

        this.saving.set(true);
        this.taskService
            .create(payload)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.saving.set(false);
                    this.resetForm();
                    this.created.emit();
                },
                error: (err: Error) => {
                    this.saving.set(false);
                    this.submitError.set(err.message || 'Tạo công việc thất bại.');
                },
            });
    }

    private resetForm(): void {
        this.form.reset({
            status: TaskStatus.NotStarted,
            priority: TaskPriority.Medium,
            isPublic: false,
        });
        this.searchedUsers.set([]);
        this.selectedMeetingName.set(null);
    }
}

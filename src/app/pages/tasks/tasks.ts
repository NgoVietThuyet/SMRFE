import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzPopoverModule } from 'ng-zorro-antd/popover';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { MeetingHubService } from '../../core/services/meeting-hub.service';
import { MeetingService } from '../../core/services/meeting.service';
import { TaskService } from '../../core/services/task.service';
import { TaskListItem, TaskPriority, TaskStatus } from '../../core/models/task.models';
import { TaskCreateModal } from './components/task-create-modal/task-create-modal';
import { TaskDetailDrawer } from './components/task-detail-drawer/task-detail-drawer';
import { CustomIconComponent } from '../../layout/shell/custom-icon/custom-icon.component';

type DuePreset = 'all' | 'overdue' | 'today' | 'upcoming';

// =====================================================
// Tasks — B1 Danh sách Công việc lớn (Work Level 0)
// Layout: header + card(list-page) + table + paging
// FilterBar: search + Người phụ trách + Trạng thái + Hạn + Cuộc họp
// Trạng thái là thuộc tính, không chia cột Kanban.
// =====================================================
@Component({
    selector: 'app-tasks',
    templateUrl: './tasks.html',
    styleUrl: './tasks.scss',
    imports: [
        CommonModule,
        FormsModule,
        NzButtonModule,
        NzEmptyModule,
        NzIconModule,
        NzInputModule,
        NzPaginationModule,
        NzPopoverModule,
        NzSelectModule,
        NzSpinModule,
        NzTableModule,
        NzTooltipModule,
        TaskCreateModal,
        TaskDetailDrawer,
        CustomIconComponent,
    ],
})
export class Tasks implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly taskService = inject(TaskService);
    private readonly meetingService = inject(MeetingService);
    private readonly hub = inject(MeetingHubService);
    private readonly auth = inject(AuthService);
    private readonly message = inject(NzMessageService);
    private readonly destroyRef = inject(DestroyRef);

    readonly TaskStatus = TaskStatus;
    readonly TaskPriority = TaskPriority;

    readonly meetingContextId = this.route.snapshot.data['meetingContext']
        ? this.route.snapshot.paramMap.get('id')
        : null;
    meetingName = signal<string | null>(null);
    meetingLoadError = signal<string | null>(null);

    readonly statusOptions = [
        { value: null as number | null, label: 'Mọi trạng thái' },
        { value: TaskStatus.NotStarted, label: 'Chưa bắt đầu' },
        { value: TaskStatus.InProgress, label: 'Đang thực hiện' },
        { value: TaskStatus.Completed, label: 'Hoàn thành' },
    ];

    readonly dueOptions: { value: DuePreset; label: string }[] = [
        { value: 'all', label: 'Mọi hạn' },
        { value: 'overdue', label: 'Quá hạn' },
        { value: 'today', label: 'Hôm nay' },
        { value: 'upcoming', label: 'Sắp tới' },
    ];

    readonly assigneeOptions = [
        { value: '' as string, label: 'Mọi người phụ trách' },
        { value: 'me', label: 'Tôi phụ trách' },
        { value: 'none', label: 'Chưa gán' },
    ];

    // Filters B1
    keyword = signal<string>('');
    statusFilter = signal<number | null>(null);
    assigneeFilter = signal<string>('');
    meetingFilter = signal<string | null>(null);
    duePreset = signal<DuePreset>('all');
    private readonly keyword$ = new Subject<string>();

    // Meeting select for filter (server search)
    meetingOptions = signal<{ id: string; name: string }[]>([]);
    meetingSearching = signal<boolean>(false);

    // Draft filter popup
    filterVisible = signal<boolean>(false);
    draftStatus = signal<number | null>(null);
    draftAssignee = signal<string>('');
    draftDue = signal<DuePreset>('all');
    draftMeeting = signal<string | null>(null);

    appliedFilterCount(): number {
        let c = 0;
        if (this.statusFilter() !== null) c++;
        if (this.assigneeFilter()) c++;
        if (this.duePreset() !== 'all') c++;
        if (this.meetingFilter()) c++;
        return c;
    }
    draftFilterCount(): number {
        let c = 0;
        if (this.draftStatus() !== null) c++;
        if (this.draftAssignee()) c++;
        if (this.draftDue() !== 'all') c++;
        if (this.draftMeeting()) c++;
        return c;
    }

    // Data — chỉ Work lớn (level 0)
    items = signal<TaskListItem[]>([]);
    summary = signal({ total: 0, mine: 0, overdue: 0, today: 0 });
    page = signal<number>(1);
    pageSize = signal<number>(10);
    total = signal<number>(0);
    loading = signal<boolean>(true);
    loadError = signal<string | null>(null);

    detailTaskId = signal<string | null>(null);
    detailOpen = signal<boolean>(false);
    createOpen = signal<boolean>(false);

    // progress helper
    progressPercent = (t: TaskListItem): number => t.progress ?? 0;

    constructor() {
        this.keyword$
            .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.reload());
        this.hub.taskChanged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.load());
    }

    ngOnInit(): void {
        this.load();
        if (this.meetingContextId) {
            this.meetingFilter.set(this.meetingContextId);
            this.loadMeetingContext(this.meetingContextId);
        }
        this.loadMeetingOptions('');
    }

    private loadMeetingContext(id: string): void {
        this.meetingService
            .getDetail(id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (detail) => {
                    this.meetingName.set(detail.name);
                    void this.hub.joinRoom(id).catch(() => undefined);
                },
                error: (err: Error) => {
                    this.meetingLoadError.set(err instanceof Error ? err.message : 'Không thể tải thông tin cuộc họp.');
                },
            });
    }

    loadMeetingOptions(keyword: string): void {
        this.meetingSearching.set(true);
        this.meetingService
            .query({ tab: 'all', keyword: keyword.trim(), status: null, page: 1, pageSize: 20, startDate: null, endDate: null })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (paged) => {
                    this.meetingOptions.set((paged.items ?? []).map((m) => ({ id: m.id, name: m.name })));
                    this.meetingSearching.set(false);
                },
                error: () => this.meetingSearching.set(false),
            });
    }

    onKeywordInput(value: string): void {
        this.keyword.set(value);
        this.keyword$.next(value);
    }
    onStatusChange(v: number | null): void { this.statusFilter.set(v); this.reload(); }
    onAssigneeChange(v: string): void { this.assigneeFilter.set(v); this.reload(); }
    onMeetingChange(v: string | null): void { this.meetingFilter.set(v); this.reload(); }
    onDueChange(v: DuePreset): void { this.duePreset.set(v); this.reload(); }

    openFilter(): void {
        this.draftStatus.set(this.statusFilter());
        this.draftAssignee.set(this.assigneeFilter());
        this.draftDue.set(this.duePreset());
        this.draftMeeting.set(this.meetingFilter());
        this.filterVisible.set(true);
    }
    closeFilter(): void { this.filterVisible.set(false); }
    resetDraftFilter(): void {
        this.draftStatus.set(null); this.draftAssignee.set(''); this.draftDue.set('all'); this.draftMeeting.set(null);
    }
    applyFilter(): void {
        this.statusFilter.set(this.draftStatus()); this.assigneeFilter.set(this.draftAssignee());
        this.duePreset.set(this.draftDue()); this.meetingFilter.set(this.draftMeeting());
        this.filterVisible.set(false); this.reload();
    }
    clearAllFilter(): void {
        this.resetDraftFilter(); this.statusFilter.set(null); this.assigneeFilter.set('');
        this.duePreset.set('all'); this.meetingFilter.set(this.meetingContextId ? this.meetingContextId : null);
        this.filterVisible.set(false); this.reload();
    }

    onPageChange(page: number): void { this.page.set(page); this.load(); }
    onPageSizeChange(size: number): void { this.pageSize.set(size); this.reload(); }
    reload(): void { this.page.set(1); this.load(); }

    load(): void {
        this.loading.set(true);
        this.loadError.set(null);
        const assignee = this.assigneeFilter();
        // Map duePreset to shortcut for BE overdue/today; upcoming is client filter fallback
        let shortcut: 'all' | 'mine' | 'overdue' | 'today' = 'all';
        if (this.duePreset() === 'overdue') shortcut = 'overdue';
        else if (this.duePreset() === 'today') shortcut = 'today';
        const meetingId = this.meetingFilter() ?? this.meetingContextId;
        this.taskService
            .query({
                shortcut,
                keyword: this.keyword().trim(),
                meetingId: meetingId ?? null,
                assignee: assignee === 'me' ? (this.auth.currentUser()?.userName ?? null) : (assignee || null),
                status: this.statusFilter(),
                priority: null,
                level: 0,
                parentId: null,
                page: this.page(),
                pageSize: this.pageSize(),
            })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (result) => {
                    let items = result.items ?? [];
                    // Client filter upcoming (due within 7 days, not overdue)
                    if (this.duePreset() === 'upcoming') {
                        const now = Date.now();
                        const seven = now + 7 * 24 * 3600_000;
                        items = items.filter((t) => t.dueDate && new Date(t.dueDate).getTime() >= now && new Date(t.dueDate).getTime() <= seven);
                    }
                    this.items.set(items);
                    this.summary.set(result.summary ?? { total: 0, mine: 0, overdue: 0, today: 0 });
                    this.total.set(result.totalItems ?? 0);
                    this.loading.set(false);
                },
                error: (err: Error) => {
                    this.loading.set(false);
                    this.loadError.set(err.message || 'Không thể tải danh sách công việc.');
                },
            });
    }

    openCreate(): void { this.createOpen.set(true); }
    closeCreate(): void { this.createOpen.set(false); }
    onTaskCreated(): void { this.createOpen.set(false); this.message.success('Tạo công việc thành công.'); this.reload(); }

    openDetail(task: TaskListItem): void { this.detailTaskId.set(task.id); this.detailOpen.set(true); }
    closeDetail(): void { this.detailOpen.set(false); }
    onDetailChanged(): void { this.load(); }

    backToMeeting(): void { const id = this.meetingContextId; if (id) void this.router.navigate(['/meetings', id]); }
    viewMeeting(meetingId: string | null): void { if (meetingId) void this.router.navigate(['/meetings', meetingId]); }

    statusLabel(status: number): string {
        const map: Record<number, string> = {
            [TaskStatus.NotStarted]: 'Chưa bắt đầu',
            [TaskStatus.InProgress]: 'Đang thực hiện',
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
    formatDue(iso: string | null): string {
        if (!iso) return '—';
        const d = new Date(iso);
        const today = new Date();
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        if (d.toDateString() === today.toDateString()) return `Hôm nay · ${time}`;
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const year = d.getFullYear() !== today.getFullYear() ? `/${d.getFullYear()}` : '';
        return `${day}/${month}${year} · ${time}`;
    }
    initials(name: string | null): string {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
}

import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzMessageService } from 'ng-zorro-antd/message';
import { catchError, forkJoin, of, Subscription } from 'rxjs';
import { DashboardPageData, DashboardService, DashboardTasks } from '../../core/services/dashboard.service';
import { AuthService } from '../../core/services/auth.service';
import { MeetingService } from '../../core/services/meeting.service';
import { TaskService } from '../../core/services/task.service';
import { MeetingListItemDto, MeetingStatus } from '../../core/models/dashboard.models';
import { MeetingDetailDto, PagedMeetings } from '../../core/models/meeting.models';
import { TaskListItem, TaskStatus } from '../../core/models/task.models';
import { CreateMeetingModal } from '../meetings/components/create-meeting-modal/create-meeting-modal';
import { TaskDetailDrawer } from '../tasks/components/task-detail-drawer/task-detail-drawer';
import { meetingStatus } from '../../shared/utils/status-map';
import { friendlyError } from '../../shared/utils/friendly-error';
import { HeaderAction, HeaderActions } from '../../shared/ui/header-actions/header-actions';

@Component({
    selector: 'app-dashboard', templateUrl: './dashboard.html', styleUrl: './dashboard.scss',
    imports: [HeaderActions, CommonModule, FormsModule, NzButtonModule, NzIconModule, NzInputModule,
        NzModalModule, NzSpinModule, NzTooltipModule, CreateMeetingModal, TaskDetailDrawer],
})
export class Dashboard implements OnInit {
    private readonly dashboardService = inject(DashboardService);
    private readonly meetingService = inject(MeetingService);
    private readonly taskService = inject(TaskService);
    private readonly auth = inject(AuthService);
    private readonly message = inject(NzMessageService);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);
    private loadSubscription?: Subscription;
    private detailsSubscription?: Subscription;

    state = signal<'loading' | 'error' | 'normal'>('loading');
    errorMessage = signal('');
    data = signal<DashboardPageData | null>(null);
    today = signal<PagedMeetings | null>(null);
    tasks = signal<DashboardTasks | null>(null);
    details = signal<Record<string, MeetingDetailDto>>({});
    showCreateModal = signal(false);
    showJoinModal = signal(false);
    joinCode = '';
    joinError = signal('');
    joining = signal(false);
    selectedTask = signal<string | null>(null);
    savingTasks = signal<string[]>([]);
    readonly MeetingStatus = MeetingStatus;

    get greetingName(): string { return this.auth.currentUser()?.fullName || this.auth.currentUser()?.userName || 'bạn'; }
    get dateLabel(): string {
        return new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    get upcoming(): MeetingListItemDto | undefined {
        return this.data()?.dashboard.nextMeetings.find(m => m.status === MeetingStatus.Scheduled);
    }
    get ongoing(): MeetingListItemDto | undefined {
        return this.data()?.dashboard.nextMeetings.find(m => m.status === MeetingStatus.Ongoing);
    }
    get todayMeetings(): MeetingListItemDto[] { return (this.today()?.items ?? []).slice(0, 3); }

    ngOnInit(): void { this.loadData(); }
    loadData(): void {
        this.loadSubscription?.unsubscribe();
        this.detailsSubscription?.unsubscribe();
        this.state.set('loading');
        this.errorMessage.set('');
        this.loadSubscription = this.dashboardService.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: data => {
                this.data.set(data); this.today.set(data.today); this.tasks.set(data.tasks);
                this.state.set('normal'); this.loadVisibleParticipants();
            },
            error: (err: Error) => {
                this.errorMessage.set(friendlyError(err, 'Không thể tải thông tin tổng quan.'));
                this.state.set('error');
            },
        });
    }
    private loadVisibleParticipants(): void {
        const meetings = [this.upcoming, this.ongoing, ...this.todayMeetings].filter((m): m is MeetingListItemDto => !!m);
        const ids = [...new Set(meetings.map(m => m.id))];
        this.details.set({});
        if (!ids.length) return;
        this.detailsSubscription = forkJoin(ids.map(id => this.meetingService.getDetail(id).pipe(catchError(() => of(null)))))
            .pipe(takeUntilDestroyed(this.destroyRef)).subscribe(details => {
                this.details.set(Object.fromEntries(details.filter((m): m is MeetingDetailDto => !!m).map(m => [m.id, m])));
            });
    }
    participants(meeting: MeetingListItemDto, limit = 5): { name: string; initials: string; tone: number }[] {
        const detail = this.details()[meeting.id];
        const names = detail ? detail.participants.map(p => p.fullName || p.userName) : (meeting.hostName ? [meeting.hostName] : []);
        return names.slice(0, limit).map(name => ({ name, initials: this.initials(name), tone: this.avatarTone(name) }));
    }
    remainingParticipants(meeting: MeetingListItemDto, limit = 5): number {
        return Math.max(0, meeting.participantCount - this.participants(meeting, limit).length);
    }
    initials(name: string): string { return name.trim().split(/\s+/).slice(-2).map(part => part[0]).join('').toUpperCase() || '?'; }
    avatarTone(name: string): number { return [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 5; }
    agenda(meeting: MeetingListItemDto): string {
        const raw = (this.details()[meeting.id]?.agenda || meeting.description || '').trim();
        if (!raw || raw === '[]' || raw === 'null' || raw === 'undefined') {
            return 'Chưa có nội dung cuộc họp.';
        }
        return raw;
    }
    liveParticipants(meeting: MeetingListItemDto): string {
        const detail = this.details()[meeting.id];
        return detail ? `${detail.participants.filter(p => p.isJoined).length} người đã tham gia` : `${meeting.participantCount} người được mời`;
    }
    navigateTo(path: string): void { void this.router.navigate([path]); }
    openMeeting(id: string): void { void this.router.navigate(['/meetings', id]); }
    joinMeeting(meeting: MeetingListItemDto): void { void this.router.navigate(['/meetings', meeting.id, 'join']); }
    createMeeting(): void { this.showCreateModal.set(true); }
    onMeetingCreated(): void {
        this.showCreateModal.set(false); this.message.success('Tạo cuộc họp thành công.'); this.loadData();
    }
    async copyInvitation(meeting: MeetingListItemDto): Promise<void> {
        const url = new URL(`/meetings/${encodeURIComponent(meeting.id)}/join`, window.location.origin).href;
        try {
            await navigator.clipboard.writeText(`${meeting.name}\n${this.formatDate(meeting.expectedStartTime)} · ${this.timeRange(meeting)}\nMã phòng: ${meeting.roomCode}\n${url}`);
            this.message.success('Đã sao chép lời mời.');
        } catch { this.message.error('Không thể sao chép. Vui lòng mở chi tiết để lấy mã phòng.'); }
    }
    // Nút header popup (Plan_GiaoDien_Drawer.md)
    readonly joinActions = computed<HeaderAction[]>(() => [
        { label: 'Đóng', run: () => this.showJoinModal.set(false) },
        { label: 'Tham gia', kind: 'primary', submitForm: 'join-code-form', loading: this.joining() },
    ]);

    openJoinModal(): void { this.joinCode = ''; this.joinError.set(''); this.showJoinModal.set(true); }
    submitJoinCode(): void {
        if (this.joining()) return;
        const code = this.joinCode.trim().toUpperCase();
        if (!code) { this.joinError.set('Vui lòng nhập mã phòng họp.'); return; }
        this.joining.set(true); this.joinError.set('');
        this.meetingService.query({ tab: 'all', keyword: code, status: null, page: 1, pageSize: 100, startDate: null, endDate: null })
            .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
                next: result => {
                    this.joining.set(false);
                    const meeting = result.items.find(m => m.roomCode.toUpperCase() === code);
                    if (!meeting) { this.joinError.set('Không tìm thấy cuộc họp hoặc bạn chưa được mời tham gia.'); return; }
                    if (!DashboardService.canJoin(meeting)) { this.joinError.set('Phòng chưa mở hoặc cuộc họp đã kết thúc. Bạn có thể tham gia trước giờ bắt đầu 5 phút.'); return; }
                    this.showJoinModal.set(false); this.joinMeeting(meeting);
                },
                error: () => { this.joining.set(false); this.joinError.set('Không thể tìm cuộc họp. Vui lòng thử lại.'); },
            });
    }
    refreshTasks(): void {
        this.dashboardService.getActionableTasks().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: tasks => this.tasks.set(tasks), error: () => this.tasks.set(null),
        });
    }
    completeTask(task: TaskListItem, event: Event): void {
        (event.target as HTMLInputElement).checked = false;
        if (!task.canEdit || this.savingTasks().includes(task.id)) return;
        this.savingTasks.update(ids => [...ids, task.id]);
        this.taskService.updateStatus(task.id, TaskStatus.Completed).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
                this.savingTasks.update(ids => ids.filter(id => id !== task.id));
                this.message.success('Đã hoàn thành công việc.'); this.refreshTasks();
            },
            error: () => {
                this.savingTasks.update(ids => ids.filter(id => id !== task.id));
                this.message.error('Chưa thể cập nhật công việc. Vui lòng thử lại.');
            },
        });
    }
    dueLabel(date: string | null): string {
        if (!date) return 'Chưa có hạn';
        const due = new Date(date), today = new Date();
        const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        if (due.toDateString() === today.toDateString()) return 'Hôm nay';
        if (due.toDateString() === tomorrow.toDateString()) return 'Ngày mai';
        today.setHours(0, 0, 0, 0);
        return due < today ? 'Quá hạn' : this.formatDate(date);
    }
    dueTone(date: string | null): string {
        const label = this.dueLabel(date);
        return label === 'Hôm nay' || label === 'Quá hạn' ? 'danger' : label === 'Ngày mai' ? 'info' : 'neutral';
    }
    formatTime(iso: string): string { return iso ? new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : ''; }
    // Định dạng cố định dd/MM — toLocaleDateString('vi-VN') ra "09-10" trên một số trình duyệt (F-20)
    formatDate(iso: string): string {
        if (!iso) return '';
        const d = new Date(iso);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    isToday(iso: string): boolean { return new Date(iso).toDateString() === new Date().toDateString(); }
    timeRange(meeting: MeetingListItemDto): string {
        return this.formatTime(meeting.expectedStartTime) + (meeting.expectedEndTime ? ` – ${this.formatTime(meeting.expectedEndTime)}` : '');
    }
    duration(meeting: MeetingListItemDto): string {
        if (!meeting.expectedEndTime) return 'Chưa có giờ kết thúc';
        return `${Math.max(0, Math.round((Date.parse(meeting.expectedEndTime) - Date.parse(meeting.expectedStartTime)) / 60000))} phút dự kiến`;
    }
    statusLabel(status: MeetingStatus): string { return meetingStatus(status).label; }
    statusClass(status: MeetingStatus): string { return meetingStatus(status).tone; }
}

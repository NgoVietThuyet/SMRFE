import { Component, computed, DestroyRef, inject, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { DashboardService } from '../../../core/services/dashboard.service';
import { TaskService } from '../../../core/services/task.service';
import { TaskListItem } from '../../../core/models/task.models';
import { MeetingService } from '../../../core/services/meeting.service';
import { MeetingDetailDto } from '../../../core/models/meeting.models';
import { MeetingStatus } from '../../../core/models/dashboard.models';
import { InfoTab } from './components/info-tab/info-tab';
import { DocsTab } from './components/docs-tab/docs-tab';
import { ParticipantsTab } from './components/participants-tab/participants-tab';
import { AiTab } from './components/ai-tab/ai-tab';
import { RecordingsTab } from './components/recordings-tab/recordings-tab';
import { meetingStatus, taskStatus } from '../../../shared/utils/status-map';
import { Avatar } from '../../../shared/ui/avatar/avatar';
import { friendlyError } from '../../../shared/utils/friendly-error';

// =====================================================
// MeetingDetail — Chi tiết cuộc họp: header 1 dòng meta + CTA
// chính theo trạng thái, 5 tab (Tổng quan | Người tham gia |
// Tài liệu | Biên bản & ghi hình | Công việc).
// =====================================================
@Component({
    selector: 'app-meeting-detail',
    templateUrl: './meeting-detail.html',
    styleUrl: './meeting-detail.scss',
    imports: [
        CommonModule,
        FormsModule,
        NzButtonModule,
        NzDropdownModule,
        NzEmptyModule,
        NzIconModule,
        NzInputModule,
        NzMenuModule,
        NzModalModule,
        NzSpinModule,
        NzTabsModule,
        InfoTab,
        DocsTab,
        ParticipantsTab,
        AiTab,
        RecordingsTab,
        Avatar,
    ],
})
export class MeetingDetail implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly meetingService = inject(MeetingService);
    private readonly taskService = inject(TaskService);
    private readonly message = inject(NzMessageService);
    private readonly destroyRef = inject(DestroyRef);

    private readonly infoTab = viewChild(InfoTab);

    meeting = signal<MeetingDetailDto | null>(null);
    loading = signal<boolean>(true);
    notFound = signal<boolean>(false);
    loadError = signal<string | null>(null);
    activeTab = signal<number>(0);

    // Tab "Công việc" — tải khi mở tab lần đầu
    private static readonly TASKS_TAB = 4;
    private static readonly POST_TAB = 3;
    tasks = signal<TaskListItem[]>([]);
    tasksTotal = signal<number | null>(null);
    tasksLoading = signal<boolean>(false);
    tasksError = signal<string | null>(null);

    /** CTA chính đổi theo trạng thái: Tham gia / Vào phòng chờ / Xem biên bản. */
    readonly primaryAction = computed<{ label: string; icon: string; kind: 'join' | 'minutes' } | null>(() => {
        const m = this.meeting();
        if (!m) return null;
        if (m.status === MeetingStatus.Ongoing) return { label: 'Tham gia', icon: 'video-camera', kind: 'join' };
        if (m.status === MeetingStatus.Scheduled)
            return DashboardService.canJoin(m)
                ? { label: 'Tham gia', icon: 'video-camera', kind: 'join' }
                : { label: 'Vào phòng chờ', icon: 'video-camera', kind: 'join' };
        if (m.status === MeetingStatus.Ended || m.status === MeetingStatus.Archived)
            return { label: 'Xem biên bản', icon: 'file-text', kind: 'minutes' };
        return null;
    });

    readonly settingList = computed(() => {
        const st = this.meeting()?.settings;
        if (!st) return [];
        return [
            { label: 'Phòng chờ', on: st.lobbyEnabled },
            { label: 'Cho phép khách', on: st.allowGuests },
            { label: 'Vào trước chủ trì', on: st.allowJoinBeforeHost },
            { label: 'Trò chuyện', on: st.chatEnabled },
            { label: 'Chia sẻ màn hình', on: st.screenShareEnabled },
            { label: 'Bảng trắng', on: st.whiteboardEnabled },
            { label: 'Ghi hình', on: st.recordingEnabled },
            { label: 'Phụ đề trực tiếp', on: st.captionsEnabled },
            { label: 'AI tạo biên bản', on: st.aiMinutesEnabled },
        ];
    });

    readonly recentActivity = computed(() =>
        [...(this.meeting()?.activity ?? [])]
            .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))
            .slice(0, 5),
    );

    // Modal hủy họp (lý do bắt buộc)
    cancelOpen = signal<boolean>(false);
    cancelReason = signal<string>('');
    cancelling = signal<boolean>(false);
    cancelError = signal<string | null>(null);

    ngOnInit(): void {
        this.load();
    }

    load(): void {
        const id = this.route.snapshot.paramMap.get('id');
        if (!id) {
            this.loading.set(false);
            this.notFound.set(true);
            return;
        }
        this.loading.set(true);
        this.loadError.set(null);
        this.notFound.set(false);
        this.meetingService
            .getDetail(id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (detail) => {
                    this.meeting.set(detail);
                    this.loading.set(false);
                },
                error: (err: unknown) => {
                    this.loading.set(false);
                    if (err instanceof HttpErrorResponse && err.status === 404) {
                        this.notFound.set(true);
                    } else {
                        this.loadError.set(
                            friendlyError(err, 'Không thể tải chi tiết cuộc họp.')
                        );
                    }
                },
            });
    }

    backToList(): void {
        void this.router.navigate(['/meetings']);
    }

    runPrimaryAction(): void {
        const action = this.primaryAction();
        if (!action) return;
        if (action.kind === 'minutes') this.activeTab.set(MeetingDetail.POST_TAB);
        else this.joinMeeting();
    }

    onTabChange(index: number): void {
        this.activeTab.set(index);
        if (index === MeetingDetail.TASKS_TAB && this.tasksTotal() === null && !this.tasksLoading()) this.loadTasks();
    }

    loadTasks(): void {
        const id = this.meeting()?.id;
        if (!id) return;
        this.tasksLoading.set(true);
        this.tasksError.set(null);
        this.taskService
            .query({ shortcut: 'all', keyword: '', meetingId: id, assignee: null, status: null, priority: null, page: 1, pageSize: 10 })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (res) => {
                    this.tasks.set(res.items);
                    this.tasksTotal.set(res.totalItems);
                    this.tasksLoading.set(false);
                },
                error: (err: unknown) => {
                    this.tasksLoading.set(false);
                    this.tasksError.set(friendlyError(err, 'Không thể tải công việc của cuộc họp.'));
                },
            });
    }

    async copyInvite(): Promise<void> {
        const m = this.meeting();
        if (!m) return;
        const link = `${location.origin}/meetings/${m.id}/join`;
        const text = `Mời tham gia cuộc họp "${m.name}"\nThời gian: ${this.formatRange(m.expectedStartTime, m.expectedEndTime)}\nMã phòng: ${m.roomCode || '—'}\nLink: ${link}`;
        try {
            await navigator.clipboard.writeText(text);
            this.message.success('Đã sao chép lời mời.');
        } catch {
            this.message.error('Không thể sao chép. Vui lòng sao chép thủ công: ' + link);
        }
    }

    taskLabel(status: number): string {
        return taskStatus(status).label;
    }

    taskTone(status: number): string {
        return taskStatus(status).tone;
    }

    activityLabel(action: string): string {
        const map: Record<string, string> = {
            Created: 'Tạo cuộc họp',
            Published: 'Gửi lời mời',
            Updated: 'Cập nhật thông tin',
            ParticipantAdded: 'Thêm người tham gia',
            ParticipantRemoved: 'Xóa người tham gia',
            Started: 'Bắt đầu cuộc họp',
            Ended: 'Kết thúc cuộc họp',
            Cancelled: 'Hủy cuộc họp',
        };
        return map[action] ?? action;
    }

    formatRange(start: string | null | undefined, end: string | null | undefined): string {
        if (!start) return '—';
        const s = new Date(start);
        const time = (d: Date) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const today = new Date();
        const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
        const day = sameDay(s, today) ? 'Hôm nay' : `${String(s.getDate()).padStart(2, '0')}/${String(s.getMonth() + 1).padStart(2, '0')}/${s.getFullYear()}`;
        const e = end ? new Date(end) : null;
        return e && sameDay(s, e) ? `${day} · ${time(s)}–${time(e)}` : `${day} · ${time(s)}`;
    }

    joinMeeting(): void {
        const id = this.meeting()?.id;
        if (id) void this.router.navigate(['/meetings', id, 'join']);
    }

    canJoin(): boolean {
        const m = this.meeting();
        return m ? DashboardService.canJoin(m) : false;
    }

    canManage(): boolean {
        return this.meeting()?.canManage ?? false;
    }

    canCancel(): boolean {
        const m = this.meeting();
        if (!m?.canManage) return false;
        return m.status === MeetingStatus.Draft || m.status === MeetingStatus.Scheduled;
    }

    editMeeting(): void {
        this.activeTab.set(0);
        // Tab render đồng bộ nên gọi sau 1 tick
        setTimeout(() => this.infoTab()?.startEdit(), 0);
    }

    viewTasks(): void {
        // Bảng công việc đầy đủ theo ngữ cảnh cuộc họp (route /meetings/:id/tasks giữ nguyên)
        const id = this.meeting()?.id;
        if (id) void this.router.navigate(['/meetings', id, 'tasks']);
    }

    openCancel(): void {
        this.cancelReason.set('');
        this.cancelError.set(null);
        this.cancelOpen.set(true);
    }

    closeCancel(): void {
        if (this.cancelling()) return;
        this.cancelOpen.set(false);
    }

    confirmCancel(): void {
        const reason = this.cancelReason().trim();
        const id = this.meeting()?.id;
        if (!reason || !id || this.cancelling()) return;
        this.cancelling.set(true);
        this.cancelError.set(null);
        this.meetingService
            .cancel(id, reason)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.cancelling.set(false);
                    this.cancelOpen.set(false);
                    this.message.success('Đã hủy cuộc họp.');
                    this.load();
                },
                error: (err: Error) => {
                    this.cancelling.set(false);
                    this.cancelError.set(err.message || 'Hủy cuộc họp thất bại.');
                },
            });
    }

    onDetailChanged(detail: MeetingDetailDto): void {
        this.meeting.set(detail);
    }

    statusLabel(status: number): string {
        return meetingStatus(status).label;
    }

    statusClass(status: number): string {
        return meetingStatus(status).tone;
    }

    visibilityLabel(visibility: number): string {
        const map: Record<number, string> = {
            0: 'Theo lời mời',
            1: 'Nội bộ',
            2: 'Công khai',
        };
        return map[visibility] ?? 'Không xác định';
    }

    formatDateTime(iso: string | null | undefined): string {
        if (!iso) return '—';
        const d = new Date(iso);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        return `${day}/${month}/${d.getFullYear()} · ${time}`;
    }
}

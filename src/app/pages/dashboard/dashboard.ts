import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzMessageService } from 'ng-zorro-antd/message';
import { DashboardPageData, DashboardService } from '../../core/services/dashboard.service';
import { MeetingDashboardDto, MeetingListItemDto, MeetingStatus } from '../../core/models/dashboard.models';
import { CreateMeetingModal } from '../meetings/components/create-meeting-modal/create-meeting-modal';

type PageState = 'loading' | 'error' | 'normal';

// =====================================================
// Dashboard — SmartMeeting
// Kết nối: GET /api/Meeting/dashboard
//          POST /api/Meeting/query (ended, page=1, size=5)
// =====================================================
@Component({
    selector: 'app-dashboard',
    templateUrl: './dashboard.html',
    styleUrl: './dashboard.scss',
    imports: [
        CommonModule,
        NzTableModule,
        NzButtonModule,
        NzEmptyModule,
        NzIconModule,
        NzSpinModule,
        NzStatisticModule,
        NzTooltipModule,
        CreateMeetingModal,
    ],
})
export class Dashboard implements OnInit {
    private readonly dashboardService = inject(DashboardService);
    private readonly message = inject(NzMessageService);
    private readonly router = inject(Router);

    state = signal<PageState>('loading');
    errorMessage = signal<string>('');
    dashboard = signal<MeetingDashboardDto | null>(null);
    recentMeetings = signal<MeetingListItemDto[]>([]);
    showCreateModal = signal<boolean>(false);

    // Constant để dùng trong template
    readonly MeetingStatus = MeetingStatus;

    ngOnInit(): void {
        this.loadData();
    }

    loadData(): void {
        this.state.set('loading');
        this.errorMessage.set('');

        this.dashboardService.getAll().subscribe({
            next: (data: DashboardPageData) => {
                this.dashboard.set(data.dashboard);
                this.recentMeetings.set(data.recentMeetings);
                this.state.set('normal');
            },
            error: (err: Error) => {
                this.errorMessage.set(err.message || 'Đã xảy ra lỗi khi tải thông tin tổng quan.');
                this.state.set('error');
            },
        });
    }

    navigateTo(path: string): void {
        void this.router.navigate([path]);
    }

    openMeeting(meetingId: string): void {
        void this.router.navigate(['/meetings', meetingId]);
    }

    joinMeeting(meeting: MeetingListItemDto, event: Event): void {
        event.stopPropagation();
        void this.router.navigate(['/meetings', meeting.id, 'join']);
    }

    createMeeting(): void {
        this.showCreateModal.set(true);
    }

    closeCreateModal(): void {
        this.showCreateModal.set(false);
    }

    onMeetingCreated(): void {
        this.showCreateModal.set(false);
        this.message.success('Tạo cuộc họp thành công.');
        this.loadData();
    }

    canJoin(meeting: MeetingListItemDto): boolean {
        return DashboardService.canJoin(meeting);
    }

    // Trả về label tiếng Việt cho MeetingStatus
    statusLabel(status: MeetingStatus): string {
        const map: Record<number, string> = {
            [MeetingStatus.Draft]: 'Bản nháp',
            [MeetingStatus.Scheduled]: 'Sắp diễn ra',
            [MeetingStatus.Ongoing]: 'Đang diễn ra',
            [MeetingStatus.Ended]: 'Đã kết thúc',
            [MeetingStatus.Cancelled]: 'Đã hủy',
            [MeetingStatus.Archived]: 'Lưu trữ',
        };
        return map[status] ?? 'Không xác định';
    }

    // CSS class suffix cho status badge
    statusClass(status: MeetingStatus): string {
        const map: Record<number, string> = {
            [MeetingStatus.Draft]: 'draft',
            [MeetingStatus.Scheduled]: 'upcoming',
            [MeetingStatus.Ongoing]: 'ongoing',
            [MeetingStatus.Ended]: 'ended',
            [MeetingStatus.Cancelled]: 'cancelled',
            [MeetingStatus.Archived]: 'archived',
        };
        return map[status] ?? 'default';
    }

    // Format giờ: 09:30 | Format ngày: 10/09 09:30
    formatTime(iso: string): string {
        if (!iso) return '';
        const d = new Date(iso);
        return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }

    formatDate(iso: string): string {
        if (!iso) return '';
        const d = new Date(iso);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        return `${day}/${month} ${this.formatTime(iso)}`;
    }

    // Kiểm tra hôm nay
    isToday(iso: string): boolean {
        if (!iso) return false;
        const d = new Date(iso);
        const now = new Date();
        return d.toDateString() === now.toDateString();
    }

    // nextMeetings: upcoming + ongoing từ BE (sort ASC, max 5)
    get nextMeetings(): MeetingListItemDto[] {
        return this.dashboard()?.nextMeetings ?? [];
    }

    // nextMeetings phân theo loại để hiển thị
    get upcomingMeetings(): MeetingListItemDto[] {
        return this.nextMeetings.filter((m) => m.status === MeetingStatus.Scheduled);
    }

    get ongoingMeetings(): MeetingListItemDto[] {
        return this.nextMeetings.filter((m) => m.status === MeetingStatus.Ongoing);
    }

    // Số liệu stats
    get stats() {
        const d = this.dashboard();
        return {
            upcoming: d?.upcoming ?? 0,
            ongoing: d?.ongoing ?? 0,
            ended: d?.ended ?? 0,
            cancelled: d?.cancelled ?? 0,
        };
    }

    // Không có meeting nào liên quan
    get isEmpty(): boolean {
        const d = this.dashboard();
        if (!d) return true;
        return d.upcoming === 0 && d.ongoing === 0 && this.recentMeetings().length === 0;
    }
}

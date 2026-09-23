import { Component, DestroyRef, inject, OnInit, signal, viewChild } from '@angular/core';
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
import { MeetingService } from '../../../core/services/meeting.service';
import { MeetingDetailDto } from '../../../core/models/meeting.models';
import { MeetingStatus } from '../../../core/models/dashboard.models';
import { InfoTab } from './components/info-tab/info-tab';
import { DocsTab } from './components/docs-tab/docs-tab';
import { ParticipantsTab } from './components/participants-tab/participants-tab';
import { AiTab } from './components/ai-tab/ai-tab';
import { RecordingsTab } from './components/recordings-tab/recordings-tab';

// =====================================================
// MeetingDetail — Chi tiết cuộc họp: header context +
// 5 tabs (Thông tin | Tài liệu | Người tham gia | AI | Ghi hình).
// Tabs underline (nz-tabs) theo style.scss.
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
    ],
})
export class MeetingDetail implements OnInit {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly meetingService = inject(MeetingService);
    private readonly message = inject(NzMessageService);
    private readonly destroyRef = inject(DestroyRef);

    private readonly infoTab = viewChild(InfoTab);

    meeting = signal<MeetingDetailDto | null>(null);
    loading = signal<boolean>(true);
    notFound = signal<boolean>(false);
    loadError = signal<string | null>(null);
    activeTab = signal<number>(0);

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
                            err instanceof Error ? err.message : 'Không thể tải chi tiết cuộc họp.'
                        );
                    }
                },
            });
    }

    backToList(): void {
        void this.router.navigate(['/meetings']);
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

    statusClass(status: number): string {
        const map: Record<number, string> = {
            [MeetingStatus.Draft]: 'pending',
            [MeetingStatus.Scheduled]: 'upcoming',
            [MeetingStatus.Ongoing]: 'ongoing',
            [MeetingStatus.Ended]: 'ended',
            [MeetingStatus.Cancelled]: 'cancelled',
            [MeetingStatus.Archived]: 'ended',
        };
        return map[status] ?? 'upcoming';
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

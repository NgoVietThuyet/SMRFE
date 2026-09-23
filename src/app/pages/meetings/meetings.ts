import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzPopoverModule } from 'ng-zorro-antd/popover';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { MeetingStatus, MeetingListItemDto } from '../../core/models/dashboard.models';
import { MeetingService } from '../../core/services/meeting.service';
import { CreateMeetingModal } from './components/create-meeting-modal/create-meeting-modal';
import { CustomIconComponent } from '../../layout/shell/custom-icon/custom-icon.component';

type DatePreset = 'all' | 'today' | 'next7' | 'past' | 'custom';

// =====================================================
// Meetings — Danh sách cuộc họp (Enterprise Productivity).
// FilterBar (search/status/date, server-side) + Table +
// phân trang server-side. Không card, không cột thừa.
// =====================================================
@Component({
    selector: 'app-meetings',
    templateUrl: './meetings.html',
    styleUrl: './meetings.scss',
    imports: [
        CommonModule,
        FormsModule,
        NzTableModule,
        NzPaginationModule,
        NzTabsModule,
        NzPopoverModule,
        NzButtonModule,
        NzEmptyModule,
        NzInputModule,
        NzSelectModule,
        NzDatePickerModule,
        NzDropdownModule,
        NzMenuModule,
        CreateMeetingModal,
        CustomIconComponent,
    ],
})
export class Meetings implements OnInit {
    private readonly meetingService = inject(MeetingService);
    private readonly message = inject(NzMessageService);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    readonly MeetingStatus = MeetingStatus;

    readonly statusOptions = [
        { value: null as number | null, label: 'Tất cả' },
        { value: MeetingStatus.Scheduled, label: 'Sắp diễn ra' },
        { value: MeetingStatus.Ongoing, label: 'Đang diễn ra' },
        { value: MeetingStatus.Ended, label: 'Đã kết thúc' },
        { value: MeetingStatus.Cancelled, label: 'Đã hủy' },
    ];

    // Tabs = từng trạng thái cuộc họp (yêu cầu: danh sách cuộc họp là màn có tab)
    readonly statusTabs = [
        { value: null as number | null, label: 'Tất cả' },
        { value: MeetingStatus.Scheduled, label: 'Sắp diễn ra' },
        { value: MeetingStatus.Ongoing, label: 'Đang diễn ra' },
        { value: MeetingStatus.Ended, label: 'Đã kết thúc' },
        { value: MeetingStatus.Cancelled, label: 'Đã hủy' },
    ];

    selectedTabIndex(): number {
        const s = this.status();
        const idx = this.statusTabs.findIndex((t) => t.value === s);
        return idx >= 0 ? idx : 0;
    }

    onTabChange(index: number): void {
        const tab = this.statusTabs[index];
        if (tab) this.onStatusChange(tab.value);
    }

    readonly dateOptions: { value: DatePreset; label: string }[] = [
        { value: 'all', label: 'Mọi thời gian' },
        { value: 'today', label: 'Hôm nay' },
        { value: 'next7', label: '7 ngày tới' },
        { value: 'past', label: 'Đã qua' },
        { value: 'custom', label: 'Khoảng thời gian' },
    ];

    // Filters
    keyword = signal<string>('');
    status = signal<number | null>(null);
    datePreset = signal<DatePreset>('all');
    customRange = signal<Date[] | null>(null);
    private readonly keyword$ = new Subject<string>();

    // Filter popup (generic)
    filterVisible = signal<boolean>(false);
    draftDatePreset = signal<DatePreset>('all');
    draftCustomRange = signal<Date[] | null>(null);

    appliedFilterCount(): number {
        let c = 0;
        if (this.datePreset() !== 'all') c++;
        if (this.customRange()) c++;
        return c;
    }

    draftFilterCount(): number {
        let c = 0;
        if (this.draftDatePreset() !== 'all') c++;
        if (this.draftCustomRange()) c++;
        return c;
    }

    openFilter(): void {
        this.draftDatePreset.set(this.datePreset());
        this.draftCustomRange.set(this.customRange());
        this.filterVisible.set(true);
    }

    closeFilter(): void {
        this.filterVisible.set(false);
    }

    resetDraftFilter(): void {
        this.draftDatePreset.set('all');
        this.draftCustomRange.set(null);
    }

    applyFilter(): void {
        this.datePreset.set(this.draftDatePreset());
        this.customRange.set(this.draftCustomRange());
        if (this.draftDatePreset() !== 'custom') this.customRange.set(null);
        this.filterVisible.set(false);
        this.reload();
    }

    clearAllFilter(): void {
        this.resetDraftFilter();
        this.datePreset.set('all');
        this.customRange.set(null);
        this.filterVisible.set(false);
        this.reload();
    }

    exportExcel(): void {
        this.message.info('Xuất Excel — chức năng demo');
    }

    // Data
    items = signal<MeetingListItemDto[]>([]);
    total = signal<number>(0);
    page = signal<number>(1);
    pageSize = signal<number>(10);
    loading = signal<boolean>(true);
    loadError = signal<string | null>(null);

    showCreateModal = signal<boolean>(false);

    constructor() {
        this.keyword$
            .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.reload());
    }

    ngOnInit(): void {
        this.load();
    }

    onKeywordInput(value: string): void {
        this.keyword.set(value);
        this.keyword$.next(value);
    }

    onStatusChange(value: number | null): void {
        this.status.set(value);
        this.reload();
    }

    onDatePresetChange(value: DatePreset): void {
        this.datePreset.set(value);
        if (value !== 'custom') this.customRange.set(null);
        this.reload();
    }

    onCustomRangeChange(value: Date[] | null): void {
        this.customRange.set(value);
        this.reload();
    }

    onPageChange(page: number): void {
        this.page.set(page);
        this.load();
    }

    onPageSizeChange(size: number): void {
        this.pageSize.set(size);
        this.reload();
    }

    reload(): void {
        this.page.set(1);
        this.load();
    }

    load(): void {
        this.loading.set(true);
        this.loadError.set(null);
        const { startDate, endDate } = this.dateRange();
        this.meetingService
            .query({
                tab: 'all',
                keyword: this.keyword().trim(),
                status: this.status(),
                page: this.page(),
                pageSize: this.pageSize(),
                startDate,
                endDate,
            })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (paged) => {
                    this.items.set(paged.items ?? []);
                    this.total.set(paged.totalItems ?? 0);
                    this.loading.set(false);
                },
                error: (err: Error) => {
                    this.loading.set(false);
                    this.loadError.set(err.message || 'Không thể tải danh sách cuộc họp.');
                },
            });
    }

    // Map preset ngày → StartDate/EndDate (ISO, BE tự về UTC)
    private dateRange(): { startDate: string | null; endDate: string | null } {
        const now = new Date();
        switch (this.datePreset()) {
            case 'today': {
                const start = new Date(now);
                start.setHours(0, 0, 0, 0);
                const end = new Date(now);
                end.setHours(23, 59, 59, 999);
                return { startDate: start.toISOString(), endDate: end.toISOString() };
            }
            case 'next7': {
                const end = new Date(now.getTime() + 7 * 24 * 3600_000);
                return { startDate: now.toISOString(), endDate: end.toISOString() };
            }
            case 'past':
                return { startDate: null, endDate: now.toISOString() };
            case 'custom': {
                const range = this.customRange();
                if (!range || range.length < 2 || !range[0] || !range[1]) {
                    return { startDate: null, endDate: null };
                }
                return { startDate: range[0].toISOString(), endDate: range[1].toISOString() };
            }
            default:
                return { startDate: null, endDate: null };
        }
    }

    viewMeeting(id: string): void {
        void this.router.navigate(['/meetings', id]);
    }

    joinMeeting(id: string, event?: Event): void {
        event?.stopPropagation();
        void this.router.navigate(['/meetings', id, 'join']);
    }

    openCreate(): void {
        this.showCreateModal.set(true);
    }

    closeCreateModal(): void {
        this.showCreateModal.set(false);
    }

    onMeetingCreated(): void {
        this.showCreateModal.set(false);
        this.message.success('Tạo cuộc họp thành công.');
        this.reload();
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

    isOngoing(item: MeetingListItemDto): boolean {
        return item.status === MeetingStatus.Ongoing;
    }

    formatTime(iso: string): string {
        if (!iso) return '';
        const d = new Date(iso);
        const today = new Date();
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        if (d.toDateString() === today.toDateString()) return `Hôm nay · ${time}`;
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        return `${day}/${month} · ${time}`;
    }
}

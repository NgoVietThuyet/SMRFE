import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, filter, finalize, takeUntil } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { GlobalService, SessionService } from '../../../../core';
import { APP_RIGHTS } from '../../../../shared/constants';
import { RealtimeHubService } from '../../../../shared/services';
import { DateTimeUtils } from '../../../../shared/utils';
import { RelativeTimePipe } from '../../../../shared/pipes/relative-time.pipe';
import { QuickMeetingModal } from '../../../dashboard/components/quick-meeting-modal/quick-meeting-modal';
import { MeetingDetail, MeetingListItem, MeetingStatus, MeetingTab } from '../../models/meeting.models';
import { MeetingService } from '../../services/meeting.service';
import { MEETING_STATUS_META, MeetingActions, copyText, meetingInviteText } from '../../utils/meeting-ui';
import { MeetingForm } from '../meeting-form/meeting-form';
import { CancelMeetingModal } from '../cancel-meeting-modal/cancel-meeting-modal';
import { ShareMeetingModal } from '../share-meeting-modal/share-meeting-modal';

const TABS: { value: MeetingTab; label: string; icon: string }[] = [
  { value: 'all', label: 'Tất cả', icon: 'unordered-list' },
  { value: 'upcoming', label: 'Sắp diễn ra', icon: 'calendar' },
  { value: 'ongoing', label: 'Đang diễn ra', icon: 'play-circle' },
  { value: 'history', label: 'Lịch sử', icon: 'history' },
  { value: 'archived', label: 'Đã lưu trữ', icon: 'inbox' },
];

/**
 * P9 — Cuộc họp của tôi (mẫu meeting/components/home + bảng CRUD của 3.FrontEnd).
 * Query: ?tab=upcoming|ongoing|history|archived · ?action=create (mở drawer tạo) · ?action=quick (mở Họp nhanh).
 */
@Component({
  selector: 'app-meeting-list',
  standalone: true,
  imports: [SharedModules, RelativeTimePipe, MeetingForm, CancelMeetingModal, ShareMeetingModal, QuickMeetingModal],
  templateUrl: './meeting-list.html',
  styleUrl: './meeting-list.scss',
})
export class MeetingList implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private refresh$ = new Subject<void>();

  readonly tabs = TABS;
  readonly statusMeta = MEETING_STATUS_META;
  readonly actions = MeetingActions;
  readonly MeetingStatus = MeetingStatus;

  tab: MeetingTab = 'all';
  private loadedTab: MeetingTab | null = null;
  keyword = '';
  range: Date[] = [];
  page = 1;
  pageSize = 20;

  items: MeetingListItem[] = [];
  total = 0;
  isLoading = false;
  now = new Date();
  canCreate = false;

  // Drawer + modal
  formVisible = false;
  formMeetingId: string | null = null;
  quickVisible = false;
  cancelTarget: MeetingListItem | null = null;
  shareTarget: MeetingListItem | null = null;
  busyId: string | null = null;

  constructor(
    private global: GlobalService,
    private session: SessionService,
    private service: MeetingService,
    private hub: RealtimeHubService,
    private route: ActivatedRoute,
    private router: Router,
    private message: NzMessageService,
  ) {
    this.global.setBreadcrumb([{ name: 'Cuộc họp của tôi', path: 'meetings' }]);
  }

  ngOnInit(): void {
    // Ai cũng tạo được cuộc họp (người tạo là chủ trì).
    this.canCreate = true;

    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const tab = params.get('tab') as MeetingTab | null;
      const nextTab = tab && TABS.some(t => t.value === tab) ? tab : 'all';
      // Bỏ ?action cũng phát lại queryParamMap → chỉ tải khi tab thật sự đổi.
      const changed = nextTab !== this.loadedTab;
      this.tab = nextTab;
      if (changed) {
        this.loadedTab = nextTab;
        this.page = 1;
        this.search();
      }
      const action = params.get('action');
      if (action && this.canCreate) {
        if (action === 'create') this.openCreate();
        if (action === 'quick') this.quickVisible = true;
        // Bỏ ?action khỏi URL để F5 không mở lại drawer.
        this.router.navigate([], { relativeTo: this.route, queryParams: { action: null }, queryParamsHandling: 'merge', replaceUrl: true });
      }
    });

    this.refresh$.pipe(debounceTime(500), takeUntil(this.destroy$)).subscribe(() => this.search(false));
    this.hub.notificationCreated
      .pipe(filter(e => !!e?.notification?.type?.startsWith('MEETING_')), takeUntil(this.destroy$))
      .subscribe(() => this.refresh$.next());
  }

  ngOnDestroy(): void {
    this.global.setBreadcrumb([]);
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===================== Tải dữ liệu =====================

  search(showLoading = true): void {
    const [from, to] = this.range ?? [];
    this.isLoading = showLoading;
    this.now = new Date();
    this.service.query({
      tab: this.tab,
      keyword: this.keyword.trim(),
      page: this.page,
      pageSize: this.pageSize,
      startDate: from ? DateTimeUtils.toUtc(DateTimeUtils.startOfDay(from)) : null,
      endDate: to ? DateTimeUtils.toUtc(DateTimeUtils.endOfDay(to)) : null,
    }, false)
      .pipe(finalize(() => this.isLoading = false), takeUntil(this.destroy$))
      .subscribe(res => {
        this.items = res?.items ?? [];
        this.total = res?.totalItems ?? 0;
      });
  }

  searchFirstPage(): void {
    this.page = 1;
    this.search();
  }

  onTabChange(tab: MeetingTab): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { tab: tab === 'all' ? null : tab }, queryParamsHandling: 'merge' });
  }

  onKeydownSearch(event: KeyboardEvent): void {
    if (event.isComposing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      this.searchFirstPage();
    }
  }

  reset(): void {
    this.keyword = '';
    this.range = [];
    this.searchFirstPage();
  }

  pageIndexChange(page: number): void {
    this.page = page;
    this.search();
  }

  pageSizeChange(size: number): void {
    this.pageSize = size;
    this.searchFirstPage();
  }

  get tabIndex(): number {
    return Math.max(0, TABS.findIndex(t => t.value === this.tab));
  }

  // ===================== Hiển thị =====================

  date(value: string | null | undefined): Date | null {
    return DateTimeUtils.fromUtc(value);
  }

  trackById = (_: number, m: MeetingListItem) => m.id;

  /** Nút chữ chính của dòng — một hành động phù hợp nhất với trạng thái. */
  primaryAction(m: MeetingListItem): { label: string; icon: string; type: 'primary' | 'default'; run: () => void } | null {
    if (m.status === MeetingStatus.Ongoing) return { label: 'Vào phòng', icon: 'login', type: 'primary', run: () => this.join(m) };
    if (this.actions.canStart(m)) return { label: 'Bắt đầu', icon: 'play-circle', type: 'primary', run: () => this.start(m) };
    if (m.status === MeetingStatus.Scheduled) return { label: 'Vào phòng', icon: 'login', type: 'default', run: () => this.join(m) };
    if (m.status === MeetingStatus.Draft && this.actions.canEdit(m)) return { label: 'Hoàn tất', icon: 'edit', type: 'default', run: () => this.openEdit(m) };
    return { label: 'Chi tiết', icon: 'file-text', type: 'default', run: () => this.openDetail(m) };
  }

  // ===================== Thao tác =====================

  openDetail(m: MeetingListItem): void {
    this.router.navigate(['/meetings', m.id]);
  }

  openCreate(): void {
    this.formMeetingId = null;
    this.formVisible = true;
  }

  openEdit(m: MeetingListItem): void {
    this.formMeetingId = m.id;
    this.formVisible = true;
  }

  onSaved(detail: MeetingDetail): void {
    if (!this.formMeetingId && detail?.id) {
      // Tạo mới → mở trang chi tiết để chia sẻ link / tải tài liệu.
      this.router.navigate(['/meetings', detail.id]);
      return;
    }
    this.search(false);
  }

  join(m: MeetingListItem): void {
    this.router.navigate(['/meetings', m.id, 'join']);
  }

  start(m: MeetingListItem): void {
    if (this.busyId) return;
    this.busyId = m.id;
    this.service.start(m.id)
      .pipe(finalize(() => this.busyId = null), takeUntil(this.destroy$))
      .subscribe(() => this.join(m));
  }

  archive(m: MeetingListItem): void {
    this.service.archive(m.id).pipe(takeUntil(this.destroy$)).subscribe(() => this.search(false));
  }

  remove(m: MeetingListItem): void {
    this.service.remove(m.id).pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.items.length === 1 && this.page > 1) this.page--;
      this.search(false);
    });
  }

  copyInvite(m: MeetingListItem): void {
    copyText(meetingInviteText(m)).then(ok => ok
      ? this.message.success('Đã sao chép lời mời')
      : this.message.warning('Trình duyệt không cho phép sao chép'));
  }

  onQuickCreated(meetingId: string): void {
    this.quickVisible = false;
    this.router.navigate(['/meetings', meetingId, 'join']);
  }
}

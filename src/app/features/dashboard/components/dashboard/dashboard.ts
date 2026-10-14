import { Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, debounceTime, filter, forkJoin, interval, takeUntil } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { GlobalService, SessionService } from '../../../../core';
import { APP_RIGHTS } from '../../../../shared/constants';
import { RealtimeHubService } from '../../../../shared/services';
import { DateTimeUtils } from '../../../../shared/utils';
import { RelativeTimePipe } from '../../../../shared/pipes/relative-time.pipe';
import { DashboardService } from '../../services/dashboard.service';
import { MeetingDashboard, MeetingListItem, MeetingStatus, TaskListItem, TaskSearchResult } from '../../models/dashboard.models';
import { QuickMeetingModal } from '../quick-meeting-modal/quick-meeting-modal';
import { JoinByCodeModal } from '../join-by-code-modal/join-by-code-modal';

type RefreshScope = 'all' | 'meetings' | 'tasks';

interface QuickItem {
  label: string;
  img: string;
  tooltip: string;
  action: () => void;
  requiredRight?: string;
}

const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
const REFRESH_MS = 60_000;
const SOON_MINUTES = 15;

/**
 * P8 — Tổng quan (mẫu 2.FrontEnd shared/layouts/home). Plan: Document/Plan_P8_TongQuan.md.
 * Làm mới: NotificationCreated (loại MEETING_* hoặc TASK_*), khi tab hiện lại, định kỳ 60 giây — MeetingStatusChanged/TaskChanged
 * chỉ phát trong phòng họp nên trang này không nhận được (Plan F4).
 */
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [SharedModules, RelativeTimePipe, QuickMeetingModal, JoinByCodeModal],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss'
})
export class Dashboard implements OnInit, OnDestroy {
  @ViewChild('ongoingBlock') ongoingBlock?: ElementRef<HTMLElement>;

  private destroy$ = new Subject<void>();
  private refresh$ = new Subject<RefreshScope>();

  readonly MeetingStatus = MeetingStatus;
  now = new Date();
  fullName = '';
  canCreateMeeting = false;
  loading = true;

  summary: MeetingDashboard | null = null;
  ongoing: MeetingListItem[] = [];
  ongoingTotal = 0;
  today: MeetingListItem[] = [];
  tasksToday: TaskSearchResult | null = null;
  tasksOverdue: TaskSearchResult | null = null;
  taskTab: 'overdue' | 'today' = 'overdue';
  private taskTabChosen = false;

  quickMeetingVisible = false;
  joinByCodeVisible = false;
  quickItems: QuickItem[] = [];

  constructor(
    private global: GlobalService,
    private session: SessionService,
    private service: DashboardService,
    private hub: RealtimeHubService,
    private router: Router,
    private message: NzMessageService,
    private zone: NgZone,
  ) {
    this.global.setBreadcrumb([{ name: 'Tổng quan', path: 'dashboard' }]);
  }

  ngOnInit(): void {
    const info = this.session.accountInfo;
    this.fullName = info?.fullName || info?.userName || '';
    // Ai cũng tạo được cuộc họp (người tạo là chủ trì).
    this.canCreateMeeting = true;
    this.quickItems = this.buildQuickItems();

    this.refresh$
      .pipe(debounceTime(500), takeUntil(this.destroy$))
      .subscribe(scope => this.load(scope, false));

    // Thông báo cá nhân là kênh realtime duy nhất trang này nhận được.
    this.hub.notificationCreated
      .pipe(filter(e => !!e?.notification?.type), takeUntil(this.destroy$))
      .subscribe(e => {
        const type = e.notification.type;
        if (type.startsWith('MEETING_')) this.refresh$.next('meetings');
        else if (type.startsWith('TASK_')) this.refresh$.next('tasks');
      });

    // Đồng hồ cho nhãn "Sau 12 phút" (không gọi API) + làm mới định kỳ khi tab đang hiện.
    interval(30_000)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.now = new Date());
    interval(REFRESH_MS)
      .pipe(filter(() => document.visibilityState === 'visible'), takeUntil(this.destroy$))
      .subscribe(() => this.refresh$.next('all'));
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    this.load('all', true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.global.setBreadcrumb([]);
    this.destroy$.next();
    this.destroy$.complete();
  }

  private onVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      this.zone.run(() => {
        this.now = new Date();
        this.refresh$.next('all');
      });
    }
  };

  // ───────────────────────── Tải dữ liệu ─────────────────────────

  private load(scope: RefreshScope, showLoading: boolean): void {
    if (scope === 'all' || scope === 'meetings') this.loadMeetings(showLoading);
    if (scope === 'all' || scope === 'tasks') this.loadTasks();
  }

  private loadMeetings(showLoading: boolean): void {
    const start = DateTimeUtils.startOfDay();
    const end = DateTimeUtils.endOfDay();
    forkJoin({
      summary: this.service.dashboard(showLoading),
      ongoing: this.service.meetings({ tab: 'ongoing', pageSize: 3 }),
      today: this.service.meetings({
        tab: 'all', pageSize: 20, startDate: DateTimeUtils.toUtc(start), endDate: DateTimeUtils.toUtc(end),
      }),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ summary, ongoing, today }) => {
          this.summary = summary;
          this.ongoing = ongoing?.items ?? [];
          this.ongoingTotal = ongoing?.totalItems ?? this.ongoing.length;
          this.today = (today?.items ?? [])
            .filter(m => m.status !== MeetingStatus.Cancelled && m.status !== MeetingStatus.Draft)
            .sort((a, b) => this.time(a.expectedStartTime) - this.time(b.expectedStartTime));
          this.loading = false;
        },
        error: () => this.loading = false,
      });
  }

  private loadTasks(): void {
    const me = this.session.accountInfo?.userName ?? null;
    // assignee = tôi: summary.today/overdue của BE đếm cả việc công khai của người khác (Plan F3).
    forkJoin({
      today: this.service.tasks({ shortcut: 'today', assignee: me, pageSize: 5 }),
      overdue: this.service.tasks({ shortcut: 'overdue', assignee: me, pageSize: 5 }),
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe(({ today, overdue }) => {
        this.tasksToday = today;
        this.tasksOverdue = overdue;
        if (!this.taskTabChosen) {
          this.taskTab = (overdue?.totalItems ?? 0) > 0 || !(today?.totalItems ?? 0) ? 'overdue' : 'today';
        }
      });
  }

  reload(): void {
    this.now = new Date();
    this.load('all', true);
  }

  // ───────────────────────── Hiển thị ─────────────────────────

  get greeting(): string {
    const hour = this.now.getHours();
    if (hour < 11) return 'Chào buổi sáng';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  }

  get todayLabel(): string {
    const d = this.now;
    return `${WEEKDAYS[d.getDay()]}, ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  }

  get todayWeekday(): string {
    return WEEKDAYS[this.now.getDay()];
  }

  get todayMonth(): string {
    return `Tháng ${this.now.getMonth() + 1}/${this.now.getFullYear()}`;
  }

  get upcomingToday(): number {
    return this.today.filter(m => m.status === MeetingStatus.Scheduled).length;
  }

  get tasks(): TaskListItem[] {
    return (this.taskTab === 'overdue' ? this.tasksOverdue?.items : this.tasksToday?.items) ?? [];
  }

  get taskTabOptions() {
    return [
      { label: `Quá hạn (${this.tasksOverdue?.totalItems ?? 0})`, value: 'overdue' },
      { label: `Hôm nay (${this.tasksToday?.totalItems ?? 0})`, value: 'today' },
    ];
  }

  onTaskTabChange(value: string | number): void {
    this.taskTab = value as 'overdue' | 'today';
    this.taskTabChosen = true;
  }

  date(value: string | null | undefined): Date | null {
    return DateTimeUtils.fromUtc(value);
  }

  isToday(value: string | null | undefined): boolean {
    const d = this.date(value);
    return !!d && DateTimeUtils.isSameDay(d, this.now);
  }

  private time(value: string | null | undefined): number {
    return DateTimeUtils.fromUtc(value)?.getTime() ?? 0;
  }

  /** Thanh màu cuộc họp sắp tới: cam nếu ≤ 15 phút, xanh nếu hôm nay, xám nếu ngày khác. */
  meetingColor(m: MeetingListItem): string {
    const start = this.date(m.expectedStartTime);
    if (!start) return '#d9d9d9';
    const minutes = (start.getTime() - this.now.getTime()) / 60_000;
    if (minutes >= 0 && minutes <= SOON_MINUTES) return '#fa8c16';
    return DateTimeUtils.isSameDay(start, this.now) ? 'var(--system-primary)' : '#d9d9d9';
  }

  isStartingSoon(m: MeetingListItem): boolean {
    const start = this.date(m.expectedStartTime);
    if (!start) return false;
    const minutes = (start.getTime() - this.now.getTime()) / 60_000;
    return minutes >= 0 && minutes <= SOON_MINUTES;
  }

  priorityColor(priority: number): string {
    return priority >= 2 ? '#ff4d4f' : priority === 1 ? '#fa8c16' : '#d9d9d9';
  }

  isOverdue(t: TaskListItem): boolean {
    const due = this.date(t.dueDate);
    return !!due && due.getTime() < this.now.getTime();
  }

  // ───────────────────────── Điều hướng / thao tác ─────────────────────────

  private buildQuickItems(): QuickItem[] {
    const items: QuickItem[] = [
      { label: 'Họp nhanh', img: 'img/desktop/meeting.png', tooltip: 'Tạo phòng và vào họp ngay', action: () => this.quickMeetingVisible = true },
      { label: 'Lên lịch họp', img: 'img/desktop/calendar.png', tooltip: 'Tạo cuộc họp theo lịch', action: () => this.router.navigate(['/meetings'], { queryParams: { action: 'create' } }) },
      { label: 'Nhập mã', img: 'img/desktop/contacts.png', tooltip: 'Tham gia bằng mã phòng', action: () => this.joinByCodeVisible = true },
      { label: 'Lịch họp', img: 'img/desktop/calendar.png', tooltip: 'Xem lịch họp', action: () => this.router.navigate(['/calendar']) },
      { label: 'Công việc', img: 'img/desktop/task.png', tooltip: 'Công việc của tôi', action: () => this.router.navigate(['/tasks']) },
      { label: 'Trợ lý AI', img: 'img/desktop/robot.png', tooltip: 'Hỏi đáp về cuộc họp', action: () => this.router.navigate(['/ai-assistant']) },
    ];
    return items.filter(i => !i.requiredRight || this.canCreateMeeting);
  }

  onOngoingCard(): void {
    if (this.ongoing.length && this.ongoingBlock) {
      this.ongoingBlock.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      this.ongoingBlock.nativeElement.focus();
      return;
    }
    this.router.navigate(['/meetings'], { queryParams: { tab: 'ongoing' } });
  }

  openMeeting(m: MeetingListItem): void {
    this.router.navigate(['/meetings', m.id]);
  }

  joinMeeting(m: MeetingListItem, event?: Event): void {
    event?.stopPropagation();
    this.router.navigate(['/meetings', m.id, 'join']);
  }

  openTask(t: TaskListItem): void {
    this.router.navigate(['/tasks'], { queryParams: { focus: t.id } });
  }

  copyInvite(m: MeetingListItem, event: Event): void {
    event.stopPropagation();
    const start = this.date(m.expectedStartTime);
    const end = this.date(m.expectedEndTime);
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const when = start
      ? `${pad(start.getDate())}/${pad(start.getMonth() + 1)}/${start.getFullYear()} · ${fmt(start)}${end ? ' – ' + fmt(end) : ''}`
      : '';
    const link = new URL(`/join/${encodeURIComponent(m.roomCode)}`, window.location.origin).href;
    const text = `${m.name}\n${when}\nMã phòng: ${m.roomCode}\n${link}`;
    this.copy(text, 'Đã sao chép lời mời');
  }

  private copy(text: string, done: string): void {
    if (!navigator.clipboard) {
      this.message.warning('Trình duyệt không cho phép sao chép');
      return;
    }
    navigator.clipboard.writeText(text)
      .then(() => this.message.success(done))
      .catch(() => this.message.warning('Không sao chép được, hãy thử lại'));
  }

  onQuickMeetingCreated(meetingId: string): void {
    this.quickMeetingVisible = false;
    this.router.navigate(['/meetings', meetingId, 'join']);
  }

  onJoinByCode(meetingId: string): void {
    this.joinByCodeVisible = false;
    this.router.navigate(['/meetings', meetingId, 'join']);
  }
}

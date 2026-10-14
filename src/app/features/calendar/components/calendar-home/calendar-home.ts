import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, filter, finalize, takeUntil } from 'rxjs';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { GlobalService, SessionService } from '../../../../core';
import { APP_RIGHTS } from '../../../../shared/constants';
import { RealtimeHubService } from '../../../../shared/services';
import { DateTimeUtils } from '../../../../shared/utils';
import { MeetingDetail, MeetingListItem, MeetingStatus } from '../../../meeting/models/meeting.models';
import { MeetingService } from '../../../meeting/services/meeting.service';
import { MEETING_STATUS_META } from '../../../meeting/utils/meeting-ui';
import { MeetingForm } from '../../../meeting/components/meeting-form/meeting-form';

type ViewMode = 'month' | 'week';

/** Cuộc họp đã đổi giờ sang Date (giờ máy). */
interface CalEvent {
  id: string;
  name: string;
  status: MeetingStatus;
  start: Date;
  end: Date;
  isHost: boolean;
  hostName: string;
  roomCode: string;
}

interface MonthDay {
  date: Date;
  key: string;
  inMonth: boolean;
  isToday: boolean;
  events: CalEvent[];
}

/** Một đoạn của cuộc họp trong cột ngày (tuần): vị trí theo phút, chia cột khi trùng giờ. */
interface WeekBlock {
  ev: CalEvent;
  top: number;
  height: number;
  left: number;
  width: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

interface WeekDay {
  date: Date;
  key: string;
  isToday: boolean;
  blocks: WeekBlock[];
}

const WEEKDAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'];
const HOUR_PX = 48;
const MAX_CHIPS = 3;
/** BE giới hạn pageSize = 100 → một request cho cả tháng (tiêu chí P11). */
const PAGE_SIZE = 100;

export const STATUS_COLOR: Record<MeetingStatus, string> = {
  [MeetingStatus.Draft]: '#bfbfbf',
  [MeetingStatus.Scheduled]: '#1677ff',
  [MeetingStatus.Ongoing]: '#52c41a',
  [MeetingStatus.Ended]: '#8c8c8c',
  [MeetingStatus.Cancelled]: '#ff7875',
  [MeetingStatus.Archived]: '#bfbfbf',
};

/**
 * P11 — Lịch họp (mẫu calendar/components/calendar-home của 2.FrontEnd, bỏ phần "lịch của tôi").
 * Dữ liệu: POST Meeting/query {tab:'all', startDate, endDate, pageSize:100} — mỗi khoảng xem 1 request.
 * Query: ?view=month|week&date=yyyy-MM-dd (giữ khi F5 / chia sẻ link).
 */
@Component({
  selector: 'app-calendar-home',
  standalone: true,
  imports: [SharedModules, MeetingForm],
  templateUrl: './calendar-home.html',
  styleUrl: './calendar-home.scss',
})
export class CalendarHome implements OnInit, OnDestroy {
  @ViewChild('timeScroll') timeScroll?: ElementRef<HTMLElement>;

  private destroy$ = new Subject<void>();
  private refresh$ = new Subject<void>();
  readonly weekdays = WEEKDAYS;
  readonly hours = Array.from({ length: 24 }, (_, h) => h);
  readonly hourPx = HOUR_PX;
  readonly statusColor = STATUS_COLOR;
  readonly legend = [MeetingStatus.Scheduled, MeetingStatus.Ongoing, MeetingStatus.Ended, MeetingStatus.Cancelled, MeetingStatus.Draft]
    .map(s => ({ status: s, label: MEETING_STATUS_META[s].label, color: STATUS_COLOR[s] }));

  view: ViewMode = 'month';
  cursor = DateTimeUtils.startOfDay(new Date());
  showCancelled = true;
  loading = false;
  truncated = 0;
  now = new Date();
  canCreate = false;

  events: CalEvent[] = [];
  monthDays: MonthDay[] = [];
  weekDays: WeekDay[] = [];

  formVisible = false;
  presetStart: Date | null = null;

  /** Khoảng đã tải — tránh gọi lại khi chỉ đổi chế độ xem trong cùng khoảng. */
  private loadedRange = '';

  constructor(
    private global: GlobalService,
    private session: SessionService,
    private meetings: MeetingService,
    private hub: RealtimeHubService,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    this.global.setBreadcrumb([{ name: 'Lịch họp', path: 'calendar' }]);
  }

  ngOnInit(): void {
    // Ai cũng tạo được cuộc họp (người tạo là chủ trì).
    this.canCreate = true;
    const params = this.route.snapshot.queryParamMap;
    if (params.get('view') === 'week') this.view = 'week';
    const date = params.get('date');
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const [y, m, d] = date.split('-').map(Number);
      this.cursor = new Date(y, m - 1, d);
    }
    this.refresh$.pipe(debounceTime(500), takeUntil(this.destroy$)).subscribe(() => this.load(true));
    this.hub.notificationCreated
      .pipe(filter(e => !!e?.notification?.type?.startsWith('MEETING_')), takeUntil(this.destroy$))
      .subscribe(() => this.refresh$.next());
    this.load();
  }

  ngOnDestroy(): void {
    this.global.setBreadcrumb([]);
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===================== Khoảng thời gian =====================

  /** Thứ 2 của tuần chứa ngày d. */
  private weekStart(d: Date): Date {
    const s = DateTimeUtils.startOfDay(d);
    s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
    return s;
  }

  /** [từ, đến) đang hiển thị: tháng = 6 tuần trọn vẹn quanh tháng; tuần = Thứ 2 → Thứ 2 tuần sau. */
  private range(): [Date, Date] {
    if (this.view === 'week') {
      const from = this.weekStart(this.cursor);
      const to = new Date(from);
      to.setDate(to.getDate() + 7);
      return [from, to];
    }
    const first = new Date(this.cursor.getFullYear(), this.cursor.getMonth(), 1);
    const from = this.weekStart(first);
    const to = new Date(from);
    to.setDate(to.getDate() + 42);
    return [from, to];
  }

  get title(): string {
    if (this.view === 'month') return `Tháng ${this.cursor.getMonth() + 1}, ${this.cursor.getFullYear()}`;
    const [from, to] = this.range();
    const last = new Date(to.getTime() - 1);
    const fmt = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
    return `${fmt(from)} – ${fmt(last)}/${last.getFullYear()}`;
  }

  prev(): void {
    this.shift(-1);
  }

  next(): void {
    this.shift(1);
  }

  private shift(step: number): void {
    const c = new Date(this.cursor);
    if (this.view === 'month') {
      c.setDate(1);
      c.setMonth(c.getMonth() + step);
      // Về lại tháng hiện tại → giữ "hôm nay" để chuyển sang Tuần ra đúng tuần này.
      const today = new Date();
      if (c.getMonth() === today.getMonth() && c.getFullYear() === today.getFullYear()) {
        this.cursor = DateTimeUtils.startOfDay(today);
        this.load();
        return;
      }
    } else {
      c.setDate(c.getDate() + 7 * step);
    }
    this.cursor = c;
    this.load();
  }

  today(): void {
    this.cursor = DateTimeUtils.startOfDay(new Date());
    this.load();
  }

  setView(view: ViewMode): void {
    this.view = view;
    this.load();
  }

  /** Bấm số ngày ở chế độ tháng → xem tuần của ngày đó. */
  openWeek(day: MonthDay, event: Event): void {
    event.stopPropagation();
    this.cursor = day.date;
    this.setView('week');
  }

  // ===================== Tải dữ liệu =====================

  load(force = false): void {
    this.syncUrl();
    const [from, to] = this.range();
    // Lấy sớm 1 ngày để cuộc họp bắt đầu hôm trước, kéo dài sang khoảng đang xem vẫn hiện (BE lọc theo giờ bắt đầu).
    const queryFrom = new Date(from);
    queryFrom.setDate(queryFrom.getDate() - 1);
    const key = `${from.getTime()}|${to.getTime()}`;
    if (!force && key === this.loadedRange) {
      this.build();
      return;
    }
    this.loading = !force;
    this.loadedRange = key;
    this.meetings.query({
      tab: 'all',
      page: 1,
      pageSize: PAGE_SIZE,
      startDate: DateTimeUtils.toUtc(queryFrom),
      endDate: DateTimeUtils.toUtc(new Date(to.getTime() - 1)),
    }, false)
      .pipe(finalize(() => this.loading = false), takeUntil(this.destroy$))
      .subscribe({
        next: res => {
          if (key !== this.loadedRange) return; // đã chuyển sang khoảng khác
          this.events = (res?.items ?? []).map(m => this.toEvent(m)).filter((e): e is CalEvent => !!e);
          this.truncated = Math.max(0, (res?.totalItems ?? 0) - (res?.items?.length ?? 0));
          this.now = new Date();
          this.build();
        },
        error: () => this.loadedRange = '',
      });
  }

  private syncUrl(): void {
    const d = this.cursor;
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    this.router.navigate([], {
      relativeTo: this.route, replaceUrl: true,
      queryParams: { view: this.view === 'month' ? null : this.view, date: DateTimeUtils.isSameDay(d, new Date()) ? null : date },
    });
  }

  private toEvent(m: MeetingListItem): CalEvent | null {
    const start = DateTimeUtils.fromUtc(m.expectedStartTime);
    if (!start) return null;
    let end = DateTimeUtils.fromUtc(m.expectedEndTime);
    if (!end || end <= start) end = new Date(start.getTime() + 30 * 60_000);
    return { id: m.id, name: m.name, status: m.status, start, end, isHost: m.isHost, hostName: m.hostName, roomCode: m.roomCode };
  }

  toggleCancelled(): void {
    this.build();
  }

  private visibleEvents(): CalEvent[] {
    return this.events
      .filter(e => this.showCancelled || e.status !== MeetingStatus.Cancelled)
      .sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());
  }

  private build(): void {
    if (this.view === 'month') this.buildMonth();
    else this.buildWeek();
  }

  /** Cuộc họp nằm trong ngày nào thì hiện ở ngày đó (kể cả kéo dài qua nhiều ngày). */
  private eventsOn(day: Date, list: CalEvent[]): CalEvent[] {
    const dayStart = DateTimeUtils.startOfDay(day).getTime();
    const dayEnd = dayStart + 86_400_000;
    return list.filter(e => e.start.getTime() < dayEnd && e.end.getTime() > dayStart);
  }

  private buildMonth(): void {
    const [from] = this.range();
    const list = this.visibleEvents();
    const today = new Date();
    this.monthDays = Array.from({ length: 42 }, (_, i) => {
      const date = new Date(from);
      date.setDate(from.getDate() + i);
      return {
        date,
        key: date.toDateString(),
        inMonth: date.getMonth() === this.cursor.getMonth(),
        isToday: DateTimeUtils.isSameDay(date, today),
        events: this.eventsOn(date, list),
      };
    });
  }

  private buildWeek(): void {
    const [from] = this.range();
    const list = this.visibleEvents();
    const today = new Date();
    this.weekDays = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(from);
      date.setDate(from.getDate() + i);
      return { date, key: date.toDateString(), isToday: DateTimeUtils.isSameDay(date, today), blocks: this.layout(date, this.eventsOn(date, list)) };
    });
    // Lần đầu mở tuần: cuộn tới 7h (hoặc giờ của cuộc họp sớm nhất).
    setTimeout(() => {
      const el = this.timeScroll?.nativeElement;
      if (el && el.scrollTop === 0) {
        const firstHour = Math.min(7, ...this.weekDays.flatMap(d => d.blocks.map(b => Math.floor(b.top / HOUR_PX))));
        el.scrollTop = Math.max(0, firstHour * HOUR_PX - 8);
      }
    });
  }

  /** Xếp các cuộc họp trùng giờ thành cột cạnh nhau (thuật toán nhóm chồng lấn). */
  private layout(day: Date, list: CalEvent[]): WeekBlock[] {
    const dayStart = DateTimeUtils.startOfDay(day).getTime();
    const dayEnd = dayStart + 86_400_000;
    const items = list.map(ev => {
      const s = Math.max(ev.start.getTime(), dayStart);
      const e = Math.min(ev.end.getTime(), dayEnd);
      return { ev, s, e, col: 0, cols: 1 };
    });
    let group: typeof items = [];
    let groupEnd = 0;
    const flush = () => {
      const columns: number[] = [];
      for (const it of group) {
        let c = columns.findIndex(end => end <= it.s);
        if (c < 0) {
          c = columns.length;
          columns.push(0);
        }
        columns[c] = it.e;
        it.col = c;
      }
      group.forEach(it => it.cols = columns.length);
      group = [];
    };
    for (const it of items) {
      if (group.length && it.s >= groupEnd) flush();
      group.push(it);
      groupEnd = Math.max(groupEnd, it.e);
    }
    flush();
    return items.map(it => ({
      ev: it.ev,
      top: ((it.s - dayStart) / 3_600_000) * HOUR_PX,
      height: Math.max(20, ((it.e - it.s) / 3_600_000) * HOUR_PX - 2),
      left: (it.col / it.cols) * 100,
      width: 100 / it.cols,
      continuesBefore: it.ev.start.getTime() < dayStart,
      continuesAfter: it.ev.end.getTime() > dayEnd,
    }));
  }

  // ===================== Hiển thị =====================

  visible(day: MonthDay): CalEvent[] {
    return day.events.length > MAX_CHIPS ? day.events.slice(0, MAX_CHIPS - 1) : day.events;
  }

  extra(day: MonthDay): number {
    return day.events.length > MAX_CHIPS ? day.events.length - (MAX_CHIPS - 1) : 0;
  }

  /** Nhãn giờ của chip: cuộc họp bắt đầu từ hôm trước → "tiếp". */
  chipTime(e: CalEvent, day: Date): string {
    if (!DateTimeUtils.isSameDay(e.start, day)) return 'tiếp';
    return `${String(e.start.getHours()).padStart(2, '0')}:${String(e.start.getMinutes()).padStart(2, '0')}`;
  }

  get nowTop(): number {
    return (this.now.getHours() + this.now.getMinutes() / 60) * HOUR_PX;
  }

  trackKey = (_: number, d: { key: string }) => d.key;

  // ===================== Thao tác =====================

  open(e: CalEvent, event?: Event): void {
    event?.stopPropagation();
    this.router.navigate(['/meetings', e.id]);
  }

  /** Bấm ô trống → drawer tạo cuộc họp (P9) với ngày/giờ điền sẵn. */
  createAt(date: Date, minutes?: number): void {
    if (!this.canCreate) return;
    const start = new Date(date);
    if (minutes === undefined) {
      // Chế độ tháng: hôm nay → mốc 30 phút kế tiếp; ngày khác → 9:00.
      if (DateTimeUtils.isSameDay(start, new Date())) {
        const now = new Date();
        start.setHours(now.getHours(), now.getMinutes() < 30 ? 30 : 60, 0, 0);
      } else {
        start.setHours(9, 0, 0, 0);
      }
    } else {
      start.setHours(0, minutes, 0, 0);
    }
    this.presetStart = start;
    this.formVisible = true;
  }

  createAtWeek(day: WeekDay, event: MouseEvent): void {
    const y = event.offsetY;
    const minutes = Math.floor((y / HOUR_PX) * 60 / 30) * 30;
    this.createAt(day.date, minutes);
  }

  createNew(): void {
    this.createAt(DateTimeUtils.isSameDay(this.cursor, new Date()) ? new Date() : this.cursor);
  }

  onSaved(_: MeetingDetail): void {
    this.load(true);
  }
}

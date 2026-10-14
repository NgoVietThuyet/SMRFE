import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, debounceTime, finalize, takeUntil } from 'rxjs';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { GlobalService } from '../../../../core';
import { DateTimeUtils } from '../../../../shared/utils';
import { MEETING_STATUS_META } from '../../../meeting/utils/meeting-ui';
import { MeetingStatus } from '../../../meeting/models/meeting.models';
import { MINUTES_STATUS_META, MinutesListItem, MinutesStatus } from '../../models/minutes.models';
import { MinutesService } from '../../services/minutes.service';

/**
 * P13 — `/minutes`: các cuộc họp tôi tham gia đã/đang diễn ra, kèm số đoạn transcript và trạng thái biên bản mới nhất.
 * Bấm dòng → trình soạn `/minutes/:meetingId`.
 */
@Component({
  selector: 'app-minutes-list',
  standalone: true,
  imports: [SharedModules],
  templateUrl: './minutes-list.html',
  styleUrl: './minutes-list.scss',
})
export class MinutesList implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private search$ = new Subject<void>();

  keyword = '';
  page = 1;
  pageSize = 20;
  items: MinutesListItem[] = [];
  total = 0;
  loading = false;

  constructor(private global: GlobalService, private service: MinutesService, private router: Router) {
    this.global.setBreadcrumb([{ name: 'Biên bản họp', path: 'minutes' }]);
  }

  ngOnInit(): void {
    this.search$.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe(() => {
      this.page = 1;
      this.load();
    });
    this.load();
  }

  ngOnDestroy(): void {
    this.global.setBreadcrumb([]);
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.service.list(this.keyword.trim(), this.page, this.pageSize)
      .pipe(finalize(() => this.loading = false), takeUntil(this.destroy$))
      .subscribe(res => {
        this.items = res?.items ?? [];
        this.total = res?.totalItems ?? 0;
      });
  }

  onKeywordChange(): void {
    this.search$.next();
  }

  reset(): void {
    this.keyword = '';
    this.page = 1;
    this.load();
  }

  pageIndexChange(page: number): void {
    this.page = page;
    this.load();
  }

  pageSizeChange(size: number): void {
    this.pageSize = size;
    this.page = 1;
    this.load();
  }

  open(item: MinutesListItem): void {
    this.router.navigate(['/minutes', item.meetingId]);
  }

  meetingMeta(status: number) {
    return MEETING_STATUS_META[status as MeetingStatus] ?? { label: '---', color: 'default' };
  }

  minutesMeta(status: MinutesStatus | null) {
    return status == null ? null : MINUTES_STATUS_META[status];
  }

  when(item: MinutesListItem): string {
    return formatRange(item.startTime, item.endTime);
  }

  trackById = (_: number, m: MinutesListItem) => m.meetingId;
}

/** "dd/MM/yyyy · HH:mm – HH:mm" từ giờ UTC. */
export function formatRange(startUtc: string | null, endUtc: string | null): string {
  const start = DateTimeUtils.fromUtc(startUtc);
  const end = DateTimeUtils.fromUtc(endUtc);
  if (!start) return '---';
  const pad = (n: number) => String(n).padStart(2, '0');
  const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return `${pad(start.getDate())}/${pad(start.getMonth() + 1)}/${start.getFullYear()} · ${hm(start)}${end ? ' – ' + hm(end) : ''}`;
}

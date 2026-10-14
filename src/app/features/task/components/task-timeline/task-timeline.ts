import { AfterViewInit, Component, ElementRef, EventEmitter, Input, OnChanges, Output, ViewChild } from '@angular/core';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { DateTimeUtils } from '../../../../shared/utils';
import { BoardCard } from '../../models/task.models';
import { CardGroup, TaskUi } from '../../utils/task-ui';

interface TimelineCol {
  date: Date;
  label: string;
  dayNum: string;
  isToday: boolean;
}

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const DAY_MS = 86_400_000;

/**
 * Dạng Timeline (port từ features/task/components/task-gantt-view của 2.FrontEnd):
 * cột trái "NHIỆM VỤ" dính cố định, mỗi cột là 1 ngày (Tuần: 80px · Tháng: 40px), thanh từ ngày bắt đầu → hạn,
 * cuộn tới mép thì tự nới thêm 60 ngày.
 */
@Component({
  selector: 'app-task-timeline',
  standalone: true,
  imports: [SharedModules],
  templateUrl: './task-timeline.html',
  styleUrl: './task-timeline.scss',
})
export class TaskTimeline implements OnChanges, AfterViewInit {
  @ViewChild('timelineContainer') timelineContainer?: ElementRef<HTMLElement>;
  @Input() groups: CardGroup[] = [];
  @Input() canEdit = false;
  @Output() cardClicked = new EventEmitter<BoardCard>();
  @Output() cardToggleComplete = new EventEmitter<BoardCard>();
  @Output() addCard = new EventEmitter<{ listId: string; title: string }>();
  @Output() addList = new EventEmitter<string>();

  readonly ui = TaskUi;
  viewMode: 'week' | 'month' = 'month';
  viewDate: Date = new Date();
  collapsedGroups = new Set<string>();
  timelineCols: TimelineCol[] = [];
  colWidth = 40;
  timelineStartDate = new Date();

  isAddingList = false;
  newListName = '';
  addingCardListId = '';
  newCardTitle = '';
  private isExtending = false;

  ngOnChanges(): void {
    this.buildTimeline();
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.scrollToToday(), 100);
  }

  get allCards(): BoardCard[] {
    return this.groups.flatMap(g => g.cards);
  }

  buildTimeline(): void {
    let min: Date | null = null;
    let max: Date | null = null;
    this.allCards.filter(c => !!c.dueDate).forEach(c => {
      const s = this.startOf(c);
      const e = this.endOf(c);
      if (!min || s < min) min = s;
      if (!max || e > max) max = e;
    });
    const today = DateTimeUtils.startOfDay(new Date());
    const start = DateTimeUtils.startOfDay(min ?? today);
    const end = DateTimeUtils.startOfDay(max ?? today);
    start.setDate(start.getDate() - 30);
    end.setDate(end.getDate() + 60);
    if (today < start) start.setTime(today.getTime() - 30 * DAY_MS);
    if (today > end) end.setTime(today.getTime() + 60 * DAY_MS);

    this.timelineStartDate = start;
    this.colWidth = this.viewMode === 'week' ? 80 : 40;
    const total = this.diffDays(end, start) + 1;
    this.timelineCols = Array.from({ length: total }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return this.col(d, today);
    });
  }

  private col(d: Date, today: Date): TimelineCol {
    const label = this.viewMode === 'month' && d.getDate() === 1 ? `Thg ${d.getMonth() + 1}` : DAY_LABELS[d.getDay()];
    return { date: d, label, dayNum: String(d.getDate()), isToday: DateTimeUtils.isSameDay(d, today) };
  }

  onScroll(e: Event): void {
    if (this.isExtending || !this.timelineCols.length) return;
    const el = e.target as HTMLElement;
    const threshold = 400;
    const today = DateTimeUtils.startOfDay(new Date());
    if (el.scrollLeft + el.clientWidth > el.scrollWidth - threshold) {
      this.isExtending = true;
      const last = this.timelineCols[this.timelineCols.length - 1].date;
      for (let i = 1; i <= 60; i++) {
        const d = new Date(last);
        d.setDate(last.getDate() + i);
        this.timelineCols.push(this.col(d, today));
      }
      setTimeout(() => this.isExtending = false, 100);
    } else if (el.scrollLeft < threshold) {
      this.isExtending = true;
      const prevWidth = el.scrollWidth;
      const first = this.timelineCols[0].date;
      const before: TimelineCol[] = [];
      for (let i = 60; i >= 1; i--) {
        const d = new Date(first);
        d.setDate(first.getDate() - i);
        before.push(this.col(d, today));
      }
      this.timelineCols = [...before, ...this.timelineCols];
      this.timelineStartDate = this.timelineCols[0].date;
      setTimeout(() => {
        el.scrollLeft += el.scrollWidth - prevWidth;
        this.isExtending = false;
      });
    }
  }

  scrollToToday(): void {
    this.scrollToDate(DateTimeUtils.startOfDay(new Date()));
  }

  jumpToDate(date: Date | null): void {
    if (date) this.scrollToDate(DateTimeUtils.startOfDay(date));
  }

  private scrollToDate(date: Date): void {
    const el = this.timelineContainer?.nativeElement;
    if (!el) return;
    el.scrollLeft = Math.max(0, this.diffDays(date, this.timelineStartDate) * this.colWidth - 150);
  }

  setMode(mode: 'week' | 'month'): void {
    this.viewMode = mode;
    this.buildTimeline();
    setTimeout(() => this.scrollToToday());
  }

  // ----- Thanh Gantt
  private startOf(c: BoardCard): Date {
    const s = DateTimeUtils.fromUtc(c.startDate);
    if (s) return DateTimeUtils.startOfDay(s);
    return DateTimeUtils.startOfDay(DateTimeUtils.fromUtc(c.dueDate) ?? new Date());
  }

  private endOf(c: BoardCard): Date {
    return DateTimeUtils.startOfDay(DateTimeUtils.fromUtc(c.dueDate) ?? this.startOf(c));
  }

  barLeft(c: BoardCard): number {
    return this.diffDays(this.startOf(c), this.timelineStartDate) * this.colWidth;
  }

  barWidth(c: BoardCard): number {
    return Math.max(1, this.diffDays(this.endOf(c), this.startOf(c)) + 1) * this.colWidth - 4;
  }

  barRange(c: BoardCard): string {
    const f = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
    const s = this.startOf(c);
    const e = this.endOf(c);
    return s.getTime() === e.getTime() ? f(e) : `${f(s)} - ${f(e)}`;
  }

  groupRange(g: CardGroup): { left: number; width: number } | null {
    const cards = g.cards.filter(c => !!c.dueDate);
    if (!cards.length) return null;
    const s = new Date(Math.min(...cards.map(c => this.startOf(c).getTime())));
    const e = new Date(Math.max(...cards.map(c => this.endOf(c).getTime())));
    return {
      left: this.diffDays(s, this.timelineStartDate) * this.colWidth,
      width: Math.max(1, this.diffDays(e, s) + 1) * this.colWidth,
    };
  }

  private diffDays(a: Date, b: Date): number {
    return Math.round((a.getTime() - b.getTime()) / DAY_MS);
  }

  toggleGroup(id: string): void {
    this.collapsedGroups.has(id) ? this.collapsedGroups.delete(id) : this.collapsedGroups.add(id);
  }

  // ----- Thêm nhanh
  startAddCard(listId: string): void {
    this.addingCardListId = listId;
    this.newCardTitle = '';
    setTimeout(() => document.getElementById('new-card-input-gv-' + listId)?.focus());
  }

  submitAddCard(listId: string): void {
    const title = this.newCardTitle.trim();
    if (!title) return;
    this.addCard.emit({ listId, title });
    this.newCardTitle = '';
  }

  onKeydownCard(e: KeyboardEvent, listId: string): void {
    if (e.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      this.submitAddCard(listId);
    } else if (e.key === 'Escape') {
      this.addingCardListId = '';
    }
  }

  startAddList(): void {
    this.isAddingList = true;
    this.newListName = '';
    setTimeout(() => document.getElementById('new-list-input-gv')?.focus());
  }

  submitAddList(): void {
    const name = this.newListName.trim();
    if (!name) return;
    this.addList.emit(name);
    this.isAddingList = false;
  }

  onKeydownList(e: KeyboardEvent): void {
    if (e.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      this.submitAddList();
    } else if (e.key === 'Escape') {
      this.isAddingList = false;
    }
  }
}

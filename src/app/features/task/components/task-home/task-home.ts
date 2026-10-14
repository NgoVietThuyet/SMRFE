import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, filter, finalize, takeUntil } from 'rxjs';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { GlobalService, SessionService } from '../../../../core';
import { RealtimeHubService } from '../../../../shared/services';
import { BACKGROUND_COLOR_DEFAULT, BoardCard, TaskGroups, TaskListItem, TaskStatus } from '../../models/task.models';
import { TaskService } from '../../services/task.service';
import { CardGroup, TaskUi } from '../../utils/task-ui';
import { TaskListView } from '../task-list-view/task-list-view';
import { CardDetailModal } from '../card-detail/card-detail';
import { WorkModal } from '../work-modal/work-modal';

type GroupKey = 'today' | 'overdue' | 'mine' | 'assigned' | 'shared' | 'public' | string;

const GROUP_TITLES: Record<string, string> = {
  today: 'Đến hạn hôm nay',
  overdue: 'Quá hạn',
  mine: 'Công việc của tôi',
  assigned: 'Được giao cho tôi',
  shared: 'Được chia sẻ',
  public: 'Công khai',
};

/**
 * P12 — Trang chủ Công việc `/tasks` (mẫu features/task/components/task-home của 2.FrontEnd).
 * Sidebar: lối tắt Hôm nay · Quá hạn; nhóm Của tôi · Được giao · Được chia sẻ · Công khai; Theo cuộc họp.
 * Vùng chính: lưới thẻ công việc (bảng) hoặc dạng danh sách cho lối tắt.
 * Query: ?group=… (shortcut là alias, link từ P8) · ?focus={id} (P8/P9/P10) · ?create=1&meetingId= (P9).
 */
@Component({
  selector: 'app-task-home',
  standalone: true,
  imports: [SharedModules, TaskListView, CardDetailModal, WorkModal],
  templateUrl: './task-home.html',
  styleUrl: './task-home.scss',
})
export class TaskHome implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private reload$ = new Subject<void>();
  readonly ui = TaskUi;
  readonly defaultColor = BACKGROUND_COLOR_DEFAULT;

  group: GroupKey = 'mine';
  counts: TaskGroups | null = null;
  keyword = '';
  loading = false;
  works: TaskListItem[] = [];
  dueGroups: CardGroup[] = [];

  workModalVisible = false;
  editingWork: TaskListItem | null = null;
  presetMeetingId: string | null = null;
  openCardId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: TaskService,
    private hub: RealtimeHubService,
    private global: GlobalService,
    private session: SessionService,
  ) {
    this.global.setBreadcrumb([{ name: 'Công việc', path: 'tasks' }]);
  }

  ngOnInit(): void {
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(q => {
      const focus = q.get('focus');
      if (focus) {
        this.openFocus(focus);
        return;
      }
      const g = q.get('group') ?? q.get('shortcut');
      const next = g && (GROUP_TITLES[g] || g.startsWith('meeting:')) ? g : 'mine';
      if (next !== this.group || (!this.works.length && !this.dueGroups.length)) {
        this.group = next;
        this.load();
      }
      if (q.get('create')) {
        this.presetMeetingId = q.get('meetingId');
        this.editingWork = null;
        this.workModalVisible = true;
        this.router.navigate([], { relativeTo: this.route, queryParams: { create: null, meetingId: null }, queryParamsHandling: 'merge', replaceUrl: true });
      }
    });
    this.loadCounts();
    this.reload$.pipe(debounceTime(500), takeUntil(this.destroy$)).subscribe(() => {
      this.loadCounts();
      this.load(false);
    });
    this.hub.notificationCreated
      .pipe(filter(e => !!e?.notification?.type?.startsWith('TASK_')), takeUntil(this.destroy$))
      .subscribe(() => this.reload$.next());
  }

  ngOnDestroy(): void {
    this.global.setBreadcrumb([]);
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===================== Tải dữ liệu =====================

  loadCounts(): void {
    this.service.groups().pipe(takeUntil(this.destroy$)).subscribe(c => this.counts = c);
  }

  get isDueView(): boolean {
    return this.group === 'today' || this.group === 'overdue';
  }

  get title(): string {
    if (this.group.startsWith('meeting:')) {
      const id = this.group.substring(8);
      return this.counts?.meetings.find(m => m.meetingId === id)?.name ?? 'Cuộc họp';
    }
    return GROUP_TITLES[this.group] ?? 'Công việc';
  }

  get canCreateHere(): boolean {
    return !this.isDueView && this.group !== 'shared' && this.group !== 'public' && this.group !== 'assigned';
  }

  load(showSpin = true): void {
    this.loading = showSpin;
    const keyword = this.keyword.trim();
    if (this.isDueView) {
      const me = this.session.accountInfo?.userName ?? null;
      this.service.query({ shortcut: this.group as 'today' | 'overdue', assignee: me, keyword, pageSize: 100 })
        .pipe(finalize(() => this.loading = false), takeUntil(this.destroy$))
        .subscribe(res => this.dueGroups = this.groupDue(res?.items ?? []));
      return;
    }
    const meetingId = this.group.startsWith('meeting:') ? this.group.substring(8) : null;
    const group = meetingId ? null : this.group as 'mine' | 'assigned' | 'shared' | 'public';
    this.service.query({ level: 0, group, meetingId, keyword, pageSize: 100 })
      .pipe(finalize(() => this.loading = false), takeUntil(this.destroy$))
      .subscribe(res => this.works = [...(res?.items ?? [])]
        .sort((a, b) => (b.updateDate ?? '').localeCompare(a.updateDate ?? '')));
  }

  /** Lối tắt Hôm nay / Quá hạn: việc giao cho tôi, nhóm theo cuộc họp. */
  private groupDue(items: TaskListItem[]): CardGroup[] {
    const map = new Map<string, CardGroup>();
    for (const t of items) {
      const key = t.meetingId ?? 'none';
      const g = map.get(key) ?? { id: key, name: t.meetingName ?? 'Không thuộc cuộc họp', cards: [] };
      g.cards.push(this.toCard(t));
      map.set(key, g);
    }
    return [...map.values()];
  }

  private toCard(t: TaskListItem): BoardCard {
    return {
      id: t.id, parentId: t.parentId ?? '', title: t.title, description: t.description ?? null,
      assigneeUserName: t.assigneeUserName, assigneeFullName: t.assigneeFullName, startDate: t.startDate ?? null,
      dueDate: t.dueDate, status: t.status, priority: t.priority, sortOrder: t.sortOrder ?? 0, isArchived: !!t.isArchived,
      labelIds: [], checklistDone: 0, checklistTotal: 0, commentCount: 0, fileCount: 0, createBy: t.createBy ?? '', canWork: true,
    };
  }

  // ===================== Điều hướng =====================

  selectGroup(g: GroupKey): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { group: g === 'mine' ? null : g, shortcut: null } });
  }

  onKeydownSearch(e: KeyboardEvent): void {
    if (e.isComposing) return;
    if (e.key === 'Enter') this.load();
  }

  openWork(w: TaskListItem): void {
    this.router.navigate(['/tasks', w.id]);
  }

  /** ?focus={id}: việc nhỏ → mở bảng + modal; đầu việc / công việc → mở bảng. */
  private openFocus(id: string): void {
    this.service.card(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: d => this.router.navigate(['/tasks', d.workId], {
        queryParams: d.workId === id ? {} : { card: id }, replaceUrl: true,
      }),
      error: () => this.router.navigate(['/tasks'], { replaceUrl: true }),
    });
  }

  openCard(card: BoardCard): void {
    this.openCardId = card.id;
  }

  onCardClosed(changed: boolean): void {
    this.openCardId = null;
    if (changed) this.reload$.next();
  }

  toggleComplete(card: BoardCard): void {
    const next = card.status === TaskStatus.Completed ? TaskStatus.InProgress : TaskStatus.Completed;
    const prev = card.status;
    card.status = next;
    this.service.setStatus(card.id, next).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.reload$.next(),
      error: () => card.status = prev,
    });
  }

  // ===================== Tạo / sửa / xoá công việc =====================

  openCreate(): void {
    this.editingWork = null;
    this.presetMeetingId = this.group.startsWith('meeting:') ? this.group.substring(8) : null;
    this.workModalVisible = true;
  }

  openEdit(w: TaskListItem, e: Event): void {
    e.stopPropagation();
    this.editingWork = w;
    this.workModalVisible = true;
  }

  onWorkSaved(w: TaskListItem): void {
    if (!this.editingWork && w?.id) {
      this.router.navigate(['/tasks', w.id]);
      return;
    }
    this.loadCounts();
    this.load(false);
  }

  deleteWork(w: TaskListItem): void {
    this.service.remove(w.id).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.works = this.works.filter(x => x.id !== w.id);
      this.loadCounts();
    });
  }

  progressOf(w: TaskListItem): number {
    return w.cardCount ? Math.round((w.cardDoneCount ?? 0) * 100 / w.cardCount) : 0;
  }
}

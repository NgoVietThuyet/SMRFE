import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Subject, debounceTime, filter, finalize, switchMap, takeUntil } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { GlobalService, SessionService } from '../../../../core';
import { RealtimeHubService } from '../../../../shared/services';
import { BACKGROUND_COLOR_DEFAULT, Board, BoardCard, BoardList, TaskStatus, priorityMeta } from '../../models/task.models';
import { TaskService, cardUpdate } from '../../services/task.service';
import { CardGroup, TaskUi } from '../../utils/task-ui';
import { TaskListView } from '../task-list-view/task-list-view';
import { TaskTimeline } from '../task-timeline/task-timeline';
import { CardDetailModal } from '../card-detail/card-detail';
import { WorkModal } from '../work-modal/work-modal';
import { TaskShareModal } from '../share-modal/share-modal';

type BoardView = 'board' | 'list' | 'timeline';

/**
 * P12 — Trang bảng `/tasks/:workId` (mẫu features/task/components/board của 2.FrontEnd).
 * Header + segmented Bảng · Danh sách · Timeline; Kanban kéo thả (cột = đầu việc, thẻ = việc nhỏ).
 * Query: ?view=board|list|timeline · ?card={id} (mở modal chi tiết).
 */
@Component({
  selector: 'app-task-board',
  standalone: true,
  imports: [SharedModules, DragDropModule, TaskListView, TaskTimeline, CardDetailModal, WorkModal, TaskShareModal],
  templateUrl: './task-board.html',
  styleUrl: './task-board.scss',
})
export class TaskBoard implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private reload$ = new Subject<void>();
  readonly ui = TaskUi;
  readonly priorityMeta = priorityMeta;
  readonly viewOptions = [
    { label: 'Bảng', value: 'board', icon: 'appstore' },
    { label: 'Danh sách', value: 'list', icon: 'bars' },
    { label: 'Timeline', value: 'timeline', icon: 'schedule' },
  ];

  workId = '';
  board: Board | null = null;
  loading = false;
  view: BoardView = 'board';
  me = '';

  // Kanban: thêm / đổi tên tại chỗ
  isAddingList = false;
  newListName = '';
  addingCardListId = '';
  newCardTitle = '';
  editingListId = '';
  editingListName = '';

  // Modal / drawer
  openCardId: string | null = null;
  workModalVisible = false;
  shareWorkId: string | null = null;
  archivedVisible = false;
  archived: BoardCard[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private service: TaskService,
    private hub: RealtimeHubService,
    private global: GlobalService,
    private session: SessionService,
    private message: NzMessageService,
  ) { }

  ngOnInit(): void {
    this.me = (this.session.accountInfo?.userName ?? '').toLowerCase();
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(p => {
      this.workId = p.get('workId') ?? '';
      this.board = null;
      this.load(true);
    });
    this.route.queryParamMap.pipe(takeUntil(this.destroy$)).subscribe(q => {
      const v = q.get('view') as BoardView | null;
      this.view = v === 'list' || v === 'timeline' ? v : 'board';
      this.openCardId = q.get('card');
    });
    // T10: thành viên khác sửa bảng → tải lại (gộp sự kiện dồn dập).
    this.reload$.pipe(debounceTime(400), takeUntil(this.destroy$)).subscribe(() => this.load(false));
    this.hub.roomEvent
      .pipe(filter(e => e.name === 'TaskChanged' && e.payload?.workId === this.workId
        && (e.payload?.by ?? '').toLowerCase() !== this.me), takeUntil(this.destroy$))
      .subscribe(() => this.reload$.next());
  }

  ngOnDestroy(): void {
    this.global.setBreadcrumb([]);
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(showSpin: boolean): void {
    this.loading = showSpin;
    this.service.board(this.workId).pipe(finalize(() => this.loading = false), takeUntil(this.destroy$)).subscribe({
      next: b => {
        // Đang kéo / sửa tại chỗ thì vẫn thay dữ liệu — thao tác cục bộ đã gửi lên BE trước đó.
        this.board = b;
        this.global.setBreadcrumb([
          { name: 'Công việc', path: 'tasks' },
          { name: b.work.title, path: `tasks/${b.work.id}` },
        ]);
      },
      error: () => this.router.navigate(['/tasks']),
    });
  }

  // ===================== Hiển thị =====================

  get canEdit(): boolean {
    return !!this.board?.canEdit;
  }

  get background(): string {
    return this.board?.work.color || BACKGROUND_COLOR_DEFAULT;
  }

  get groups(): CardGroup[] {
    return (this.board?.lists ?? []).map(l => ({ id: l.id, name: l.title, cards: l.cards }));
  }

  get listDropIds(): string[] {
    return (this.board?.lists ?? []).map(l => 'list-' + l.id);
  }

  labelsOf(card: BoardCard) {
    return this.ui.labelsOf(card, this.board?.labels ?? []);
  }

  setView(view: BoardView): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { view: view === 'board' ? null : view }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  goBack(): void {
    this.router.navigate(['/tasks']);
  }

  // ===================== Kéo thả (CDK) =====================

  dropList(event: CdkDragDrop<BoardList[]>): void {
    if (!this.canEdit || !this.board || event.previousIndex === event.currentIndex) return;
    const lists = this.board.lists;
    moveItemInArray(lists, event.previousIndex, event.currentIndex);
    const moved = lists[event.currentIndex];
    const before = lists[event.currentIndex + 1]?.id ?? null;
    this.service.move(moved.id, this.workId, before).pipe(takeUntil(this.destroy$)).subscribe({ error: () => this.load(false) });
  }

  dropCard(event: CdkDragDrop<BoardCard[]>, target: BoardList): void {
    if (!this.canEdit) return;
    if (event.previousContainer === event.container) {
      if (event.previousIndex === event.currentIndex) return;
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(event.previousContainer.data, event.container.data, event.previousIndex, event.currentIndex);
    }
    const card = event.container.data[event.currentIndex];
    card.parentId = target.id;
    const before = event.container.data[event.currentIndex + 1]?.id ?? null;
    this.service.move(card.id, target.id, before).pipe(takeUntil(this.destroy$)).subscribe({ error: () => this.load(false) });
  }

  // ===================== Thẻ =====================

  openCard(card: BoardCard): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { card: card.id }, queryParamsHandling: 'merge' });
  }

  onCardClosed(changed: boolean): void {
    this.router.navigate([], { relativeTo: this.route, queryParams: { card: null }, queryParamsHandling: 'merge', replaceUrl: true });
    if (changed) {
      this.load(false);
      if (this.archivedVisible) this.loadArchived();
    }
  }

  toggleComplete(card: BoardCard): void {
    if (!card.canWork) return;
    const next = card.status === TaskStatus.Completed ? TaskStatus.InProgress : TaskStatus.Completed;
    const prev = card.status;
    card.status = next;
    this.service.setStatus(card.id, next).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.board && (this.board.work.cardDoneCount = this.countDone()),
      error: () => card.status = prev,
    });
  }

  private countDone(): number {
    return (this.board?.lists ?? []).reduce((n, l) => n + l.cards.filter(c => c.status === TaskStatus.Completed).length, 0);
  }

  startAddCard(listId: string): void {
    this.addingCardListId = listId;
    this.newCardTitle = '';
    setTimeout(() => document.getElementById('new-card-input-' + listId)?.focus());
  }

  addCard(listId: string, title = this.newCardTitle): void {
    const t = title.trim();
    if (!t) return;
    this.service.create({ parentId: listId, level: 2, title: t }, false).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.newCardTitle = '';
      this.load(false);
    });
  }

  onKeydownCard(e: KeyboardEvent, listId: string): void {
    if (e.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      this.addCard(listId);
    } else if (e.key === 'Escape') {
      this.addingCardListId = '';
    }
  }

  // ===================== Cột =====================

  startAddList(): void {
    this.isAddingList = true;
    this.newListName = '';
    setTimeout(() => document.getElementById('new-list-input')?.focus());
  }

  addList(name = this.newListName): void {
    const t = name.trim();
    if (!t) return;
    this.service.create({ parentId: this.workId, level: 1, title: t }, false).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.newListName = '';
      this.load(false);
    });
  }

  onKeydownList(e: KeyboardEvent): void {
    if (e.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      this.addList();
    } else if (e.key === 'Escape') {
      this.isAddingList = false;
    }
  }

  startEditList(list: BoardList, e: Event): void {
    e.stopPropagation();
    if (!this.canEdit) return;
    this.editingListId = list.id;
    this.editingListName = list.title;
    setTimeout(() => (document.getElementById('edit-list-' + list.id) as HTMLInputElement | null)?.select());
  }

  /** Đổi tên cột: lấy đủ trường của đầu việc rồi PUT (BE yêu cầu gửi đủ, tránh xoá hạn / người phụ trách cũ). */
  saveListName(list: BoardList): void {
    const title = this.editingListName.trim();
    this.editingListId = '';
    if (!title || title === list.title) return;
    const old = list.title;
    list.title = title;
    this.service.detail(list.id).pipe(
      switchMap(d => this.service.update(list.id, cardUpdate({
        title: d.title, description: d.description ?? null, assigneeUserName: d.assigneeUserName, dueDate: d.dueDate,
        status: d.status, priority: d.priority,
      }, { title }))),
      takeUntil(this.destroy$),
    ).subscribe({ error: () => list.title = old });
  }

  onKeydownEditList(e: KeyboardEvent, list: BoardList): void {
    if (e.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      this.saveListName(list);
    } else if (e.key === 'Escape') {
      this.editingListId = '';
    }
  }

  deleteList(list: BoardList): void {
    this.service.remove(list.id).pipe(takeUntil(this.destroy$)).subscribe(() => this.load(false));
  }

  // ===================== Công việc (bảng) =====================

  onWorkSaved(): void {
    this.load(false);
  }

  deleteWork(): void {
    this.service.remove(this.workId).pipe(takeUntil(this.destroy$)).subscribe(() => this.router.navigate(['/tasks']));
  }

  openArchived(): void {
    this.archivedVisible = true;
    this.loadArchived();
  }

  loadArchived(): void {
    this.service.board(this.workId, true).pipe(takeUntil(this.destroy$)).subscribe(b => {
      this.archived = b.lists.flatMap(l => l.cards);
    });
  }

  restore(card: BoardCard): void {
    this.service.update(card.id, cardUpdate(card, { isArchived: false }), true).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.archived = this.archived.filter(c => c.id !== card.id);
      this.load(false);
    });
  }
}

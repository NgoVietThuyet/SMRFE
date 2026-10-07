import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnDestroy, signal, viewChildren } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { filter } from 'rxjs';
import { BoardColumn, TaskListItem, TaskStatus } from '../../../core/models/task.models';
import { AuthService } from '../../../core/services/auth.service';
import { MeetingHubService } from '../../../core/services/meeting-hub.service';
import { BOARD_PAGE_SIZE, TaskBoardStore } from '../../../core/services/task-board.store';
import { SelectA11yDirective } from '../../../shared/a11y/select-a11y.directive';
import { Avatar } from '../../../shared/ui/avatar/avatar';
import { friendlyError } from '../../../shared/utils/friendly-error';
import { taskStatus } from '../../../shared/utils/status-map';
import { shortDate } from '../../../shared/utils/task-format';
import { CardDetail } from '../card-detail/card-detail';
import { TaskDetailDrawer } from '../components/task-detail-drawer/task-detail-drawer';
import { BoardColumnComponent, CardDropEvent, QuickAddEvent } from './board-column/board-column';

// =====================================================
// TaskBoard — /tasks/:workId (+ /cards/:cardId mở chi tiết).
// Bảng Kanban của một Công việc (level 0): 3 cột theo trạng thái,
// thẻ = Đầu việc (level 1). Kéo thả đổi trạng thái (PATCH /status).
// =====================================================
@Component({
    selector: 'app-task-board',
    templateUrl: './task-board.html',
    styleUrl: './task-board.scss',
    providers: [TaskBoardStore],
    imports: [
        Avatar,
        BoardColumnComponent,
        CardDetail,
        CdkDropListGroup,
        CommonModule,
        FormsModule,
        NzButtonModule,
        NzEmptyModule,
        NzIconModule,
        NzSelectModule,
        RouterLink,
        SelectA11yDirective,
        TaskDetailDrawer,
    ],
})
export class TaskBoard implements OnDestroy {
    protected readonly store = inject(TaskBoardStore);
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly hub = inject(MeetingHubService);
    private readonly auth = inject(AuthService);
    private readonly message = inject(NzMessageService);
    private readonly destroyRef = inject(DestroyRef);

    protected readonly BOARD_PAGE_SIZE = BOARD_PAGE_SIZE;

    /** Cuộc họp đã mở bảng này (query ?meeting=) — để nút quay lại về đúng cuộc họp. */
    protected readonly fromMeetingId = signal<string | null>(null);
    protected readonly cardId = signal<string | null>(null);
    /** Cột đang xem trên mobile (<768px chỉ hiện 1 cột). */
    protected readonly activeStatus = signal<TaskStatus>(TaskStatus.NotStarted);
    protected readonly editOpen = signal(false);
    protected readonly liveMessage = signal('');

    private joinedMeetingId: string | null = null;
    private readonly columnRefs = viewChildren(BoardColumnComponent);

    protected readonly board = this.store.board;
    protected readonly columns = this.store.columns;
    protected readonly canAdd = computed(() => !!this.board()?.canEdit);
    protected readonly assigneeOptions = computed(() => [
        { value: '', label: 'Mọi người phụ trách' },
        { value: 'none', label: 'Chưa gán' },
        ...this.store.assignees().map((a) => ({ value: a.userName, label: a.fullName })),
    ]);
    protected readonly headerAssignees = computed(() => this.store.assignees().slice(0, 3));
    protected readonly moreAssignees = computed(() => Math.max(0, this.store.assignees().length - 3));

    constructor() {
        this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((p) => {
            const workId = p.get('workId');
            if (workId) void this.store.load(workId).then(() => this.syncRealtime());
        });
        this.route.queryParamMap
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((q) => this.fromMeetingId.set(q.get('meeting')));

        this.readCardParam();
        this.router.events
            .pipe(
                filter((e) => e instanceof NavigationEnd),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe(() => this.readCardParam());

        // Realtime: chỉ có khi bảng gắn cuộc họp (BE phát TaskChanged trong nhóm cuộc họp).
        this.hub.taskChanged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((e) => {
            const b = this.board();
            if (!b || e.meetingId !== b.meetingId) return;
            if (e.userName && e.userName === this.auth.currentUser()?.userName) return;
            const workId = this.store.workId();
            if (!workId) return;
            if (this.store.card(e.taskId) && e.action !== 'deleted' && e.action !== 'created') {
                void this.store.refreshCard(e.taskId);
            } else {
                void this.store.load(workId, { quiet: true });
            }
        });

        // Bảng không gắn cuộc họp: làm mới khi người dùng quay lại tab.
        const onVisible = () => {
            const workId = this.store.workId();
            if (document.visibilityState === 'visible' && workId && !this.store.loading()) {
                void this.store.load(workId, { quiet: true });
            }
        };
        document.addEventListener('visibilitychange', onVisible);
        this.destroyRef.onDestroy(() => document.removeEventListener('visibilitychange', onVisible));
    }

    ngOnDestroy(): void {
        if (this.joinedMeetingId) void this.hub.leaveRoom(this.joinedMeetingId).catch(() => undefined);
    }

    private readCardParam(): void {
        this.cardId.set(this.route.snapshot.firstChild?.paramMap.get('cardId') ?? null);
    }

    private syncRealtime(): void {
        const meetingId = this.board()?.meetingId ?? null;
        if (meetingId === this.joinedMeetingId) return;
        if (this.joinedMeetingId) void this.hub.leaveRoom(this.joinedMeetingId).catch(() => undefined);
        this.joinedMeetingId = meetingId;
        if (meetingId) void this.hub.joinRoom(meetingId).catch(() => undefined);
    }

    // ── Điều hướng ─────────────────────────────────

    protected backLink(): (string | null)[] {
        const m = this.fromMeetingId();
        return m ? ['/meetings', m] : ['/tasks'];
    }

    protected backLabel(): string {
        return this.fromMeetingId() ? 'Quay lại cuộc họp' : 'Quay lại danh sách công việc';
    }

    protected openCard(card: TaskListItem): void {
        const workId = this.store.workId();
        if (!workId) return;
        void this.router.navigate(['/tasks', workId, 'cards', card.id], { queryParamsHandling: 'preserve' });
    }

    protected closeCard(): void {
        const workId = this.store.workId();
        if (workId) void this.router.navigate(['/tasks', workId], { queryParamsHandling: 'preserve' });
    }

    protected retry(): void {
        const workId = this.store.workId();
        if (workId) void this.store.load(workId);
    }

    // ── Kéo thả / chuyển cột ───────────────────────

    protected cardsOf(col: BoardColumn): TaskListItem[] {
        return this.store.cardsByStatus().get(col.status) ?? [];
    }

    protected onDropped(e: CardDropEvent): void {
        void this.moveCard(e.card, e.toStatus);
    }

    protected onMoveBy(card: TaskListItem, delta: number): void {
        const cols = this.columns();
        const idx = cols.findIndex((c) => c.status === card.status);
        const target = cols[idx + delta];
        if (!target) {
            this.announce(delta > 0 ? 'Đầu việc đã ở cột cuối.' : 'Đầu việc đã ở cột đầu.');
            return;
        }
        void this.moveCard(card, target.status).then(() => this.refocus(card.id));
    }

    async moveCard(card: TaskListItem, toStatus: TaskStatus): Promise<void> {
        const title = this.columns().find((c) => c.status === toStatus)?.title ?? taskStatus(toStatus).label;
        const error = await this.store.move(card.id, toStatus);
        if (error) {
            this.message.error(error);
            this.announce(`Không chuyển được “${card.title}”. ${error}`);
            return;
        }
        this.activeStatus.set(toStatus);
        this.announce(`Đã chuyển “${card.title}” sang ${title}.`);
    }

    private refocus(cardId: string): void {
        // Thẻ được render lại ở cột mới — đưa focus theo để thao tác bàn phím liên tục.
        setTimeout(() => {
            const idx = this.store.cardsByStatus().get(this.store.card(cardId)?.status ?? -1)?.findIndex((c) => c.id === cardId) ?? -1;
            const col = this.columns().findIndex((c) => c.status === this.store.card(cardId)?.status);
            if (idx < 0 || col < 0) return;
            const el = document.querySelectorAll<HTMLElement>('.task-board__columns app-board-column')[col]
                ?.querySelectorAll<HTMLElement>('app-task-card')[idx];
            el?.focus();
        });
    }

    protected addToFirstColumn(): void {
        // Mobile: thêm vào cột đang xem; desktop: cột đầu tiên.
        const narrow = window.matchMedia('(max-width: 767px)').matches;
        const refs = this.columnRefs();
        const target = narrow ? refs.find((r) => r.column().status === this.activeStatus()) : refs[0];
        target?.startAdd();
    }

    protected onQuickAdd(e: QuickAddEvent): void {
        this.store.addCard(e.title, e.status).then(
            (card) => {
                e.done(true);
                this.announce(`Đã thêm đầu việc “${card.title}”.`);
            },
            (err) => {
                e.done(false);
                this.message.error(friendlyError(err, 'Không thêm được đầu việc.'));
            }
        );
    }

    private announce(text: string): void {
        // Đặt rỗng trước để screen reader đọc lại cả khi nội dung trùng lần trước.
        this.liveMessage.set('');
        setTimeout(() => this.liveMessage.set(text), 50);
    }

    // ── Header ─────────────────────────────────────

    protected statusView(status: number) {
        return taskStatus(status);
    }

    protected dueText(iso: string | null): string {
        return shortDate(iso);
    }

    protected onEditChanged(): void {
        const workId = this.store.workId();
        if (workId) void this.store.load(workId, { quiet: true });
    }

    protected onEditClosed(): void {
        this.editOpen.set(false);
    }

    protected onCardChanged(cardId: string): void {
        void this.store.refreshCard(cardId);
    }

    protected onCardDeleted(cardId: string): void {
        this.store.removeCard(cardId);
        this.closeCard();
    }
}

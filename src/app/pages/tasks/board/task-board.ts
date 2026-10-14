import { CdkDropListGroup } from '@angular/cdk/drag-drop';
import { CommonModule } from '@angular/common';
import { Component, computed, DestroyRef, ElementRef, inject, OnDestroy, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, NavigationEnd, Router, RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { filter } from 'rxjs';
import { TaskListItem, TaskStatus } from '../../../core/models/task.models';
import { AuthService } from '../../../core/services/auth.service';
import { MeetingHubService } from '../../../core/services/meeting-hub.service';
import { BOARD_PAGE_SIZE, TaskBoardStore } from '../../../core/services/task-board.store';
import { SelectA11yDirective } from '../../../shared/a11y/select-a11y.directive';
import { Avatar } from '../../../shared/ui/avatar/avatar';
import { friendlyError } from '../../../shared/utils/friendly-error';
import { ConfirmDialogService } from '../../../shared/ui/confirm-dialog/confirm-dialog';
import { taskStatus } from '../../../shared/utils/status-map';
import { shortDate } from '../../../shared/utils/task-format';
import { CardDetail } from '../card-detail/card-detail';
import { TaskDetailDrawer } from '../components/task-detail-drawer/task-detail-drawer';
import { BoardColumnComponent, CardDropEvent, QuickAddEvent } from './board-column/board-column';

// =====================================================
// TaskBoard — /tasks/:workId (+ /cards/:cardId mở chi tiết việc nhỏ).
// Bảng Kanban của một Công việc (level 0). Bảng mới trống:
// người dùng tự "Thêm đầu việc" → mỗi Đầu việc (level 1) là một cột,
// thân cột chứa các thẻ Việc nhỏ (level 2). Kéo thẻ giữa cột = đổi
// Đầu việc cha (PUT parentId).
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
        NzInputModule,
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
    private readonly dialog = inject(ConfirmDialogService);
    private readonly destroyRef = inject(DestroyRef);

    protected readonly BOARD_PAGE_SIZE = BOARD_PAGE_SIZE;

    /** Cuộc họp đã mở bảng này (query ?meeting=) — để nút quay lại về đúng cuộc họp. */
    protected readonly fromMeetingId = signal<string | null>(null);
    protected readonly cardId = signal<string | null>(null);
    /** Id task đang mở trong drawer "Sửa thông tin" (bảng hoặc một đầu việc). */
    protected readonly infoTaskId = signal<string | null>(null);
    protected readonly liveMessage = signal('');

    // Ô "Thêm đầu việc" ở cuối dãy cột
    protected readonly addingList = signal(false);
    protected readonly listDraft = signal('');
    protected readonly listSaving = signal(false);
    private readonly listInput = viewChild<ElementRef<HTMLInputElement>>('listInput');

    private joinedMeetingId: string | null = null;

    protected readonly board = this.store.board;
    protected readonly lists = this.store.sortedLists;
    protected readonly canAddList = computed(() => !!this.board()?.canEdit);
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
            const workId = this.store.workId();
            if (!b || !workId || e.meetingId !== b.meetingId) return;
            if (e.userName && e.userName === this.auth.currentUser()?.userName) return;
            if (this.store.card(e.taskId) && e.action !== 'deleted') void this.store.refreshCard(e.taskId);
            else void this.store.load(workId, { quiet: true });
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

    // ── Cột (Đầu việc) ─────────────────────────────

    protected startAddList(): void {
        this.addingList.set(true);
        setTimeout(() => {
            const el = this.listInput()?.nativeElement;
            el?.scrollIntoView?.({ block: 'nearest', inline: 'end', behavior: 'smooth' });
            el?.focus();
        });
    }

    protected cancelAddList(): void {
        if (this.listSaving()) return;
        this.addingList.set(false);
        this.listDraft.set('');
    }

    protected async submitAddList(): Promise<void> {
        const title = this.listDraft().trim();
        if (!title || this.listSaving()) return;
        this.listSaving.set(true);
        try {
            const list = await this.store.addList(title);
            this.listDraft.set('');
            this.announce(`Đã thêm đầu việc “${list.title}”.`);
            // Giữ ô mở để thêm liên tiếp nhiều cột.
            setTimeout(() => this.listInput()?.nativeElement.focus());
        } catch (err) {
            this.message.error(friendlyError(err, 'Không thêm được đầu việc.'));
        } finally {
            this.listSaving.set(false);
        }
    }

    protected async onRenameList(list: TaskListItem, title: string): Promise<void> {
        const error = await this.store.renameList(list.id, title);
        if (error) this.message.error(error);
    }

    protected onRemoveList(list: TaskListItem): void {
        const count = this.store.cardsByList().get(list.id)?.length ?? 0;
        if (count > 0) {
            this.message.warning(`“${list.title}” còn ${count} việc nhỏ. Hãy xóa hoặc chuyển chúng sang đầu việc khác trước.`);
            return;
        }
        void this.dialog.open({
            title: 'Xóa đầu việc?',
            content: `Đầu việc “${list.title}” sẽ bị xóa khỏi bảng. Hành động này không thể hoàn tác.`,
            okText: 'Xóa',
            danger: true,
            onOk: async () => {
                const error = await this.store.removeList(list.id);
                if (error) {
                    this.message.error(error);
                    throw new Error(error);
                }
                this.announce(`Đã xóa đầu việc “${list.title}”.`);
            },
        });
    }

    // ── Thẻ (Việc nhỏ) ─────────────────────────────

    protected cardsOf(list: TaskListItem): TaskListItem[] {
        return this.store.cardsByList().get(list.id) ?? [];
    }

    protected onDropped(e: CardDropEvent): void {
        void this.moveCard(e.card, e.toListId);
    }

    protected onMoveBy(card: TaskListItem, delta: number): void {
        const lists = this.lists();
        const idx = lists.findIndex((l) => l.id === card.parentId);
        const target = lists[idx + delta];
        if (!target) {
            this.announce(delta > 0 ? 'Việc nhỏ đã ở đầu việc cuối cùng.' : 'Việc nhỏ đã ở đầu việc đầu tiên.');
            return;
        }
        void this.moveCard(card, target.id).then(() => this.refocus(card.id));
    }

    async moveCard(card: TaskListItem, toListId: string): Promise<void> {
        const title = this.store.list(toListId)?.title ?? '';
        const error = await this.store.moveCard(card.id, toListId);
        if (error) {
            this.message.error(error);
            this.announce(`Không chuyển được “${card.title}”. ${error}`);
            return;
        }
        this.announce(`Đã chuyển “${card.title}” sang ${title}.`);
    }

    protected async onToggle(card: TaskListItem, done: boolean): Promise<void> {
        const error = await this.store.setCardStatus(card.id, done ? TaskStatus.Completed : TaskStatus.NotStarted);
        if (error) this.message.error(error);
        else this.announce(done ? `Đã hoàn thành “${card.title}”.` : `Đã bỏ hoàn thành “${card.title}”.`);
    }

    private refocus(cardId: string): void {
        // Thẻ được render lại ở cột mới — đưa focus theo để thao tác bàn phím liên tục.
        setTimeout(() => {
            const card = this.store.card(cardId);
            if (!card) return;
            const col = this.lists().findIndex((l) => l.id === card.parentId);
            const idx = this.store.cardsByList().get(card.parentId ?? '')?.findIndex((c) => c.id === cardId) ?? -1;
            if (idx < 0 || col < 0) return;
            const el = document.querySelectorAll<HTMLElement>('.task-board__columns app-board-column')[col]
                ?.querySelectorAll<HTMLElement>('app-task-card')[idx];
            el?.focus();
        });
    }

    protected onQuickAdd(e: QuickAddEvent): void {
        this.store.addCard(e.listId, e.title).then(
            (card) => {
                e.done(true);
                this.announce(`Đã thêm việc nhỏ “${card.title}”.`);
            },
            (err) => {
                e.done(false);
                this.message.error(friendlyError(err, 'Không thêm được việc nhỏ.'));
            }
        );
    }

    private announce(text: string): void {
        // Đặt rỗng trước để screen reader đọc lại cả khi nội dung trùng lần trước.
        this.liveMessage.set('');
        setTimeout(() => this.liveMessage.set(text), 50);
    }

    // ── Header / drawer ────────────────────────────

    protected statusView(status: number) {
        return taskStatus(status);
    }

    protected dueText(iso: string | null): string {
        return shortDate(iso);
    }

    protected onInfoChanged(): void {
        const workId = this.store.workId();
        if (workId) void this.store.load(workId, { quiet: true });
    }

    protected onCardChanged(cardId: string): void {
        void this.store.refreshCard(cardId);
    }

    protected onCardDeleted(cardId: string): void {
        this.store.removeCard(cardId);
        this.closeCard();
    }
}

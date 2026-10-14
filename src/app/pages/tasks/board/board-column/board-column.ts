import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, computed, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { TaskListItem, TaskStatus } from '../../../../core/models/task.models';
import { TaskCard } from '../task-card/task-card';

export interface CardDropEvent {
    card: TaskListItem;
    toListId: string;
}

export interface QuickAddEvent {
    listId: string;
    title: string;
    done: (ok: boolean) => void;
}

// =====================================================
// BoardColumn — một cột = một Đầu việc (level 1).
// Đầu cột: tên (sửa tại chỗ) + số việc nhỏ đã xong + menu.
// Thân cột: cdkDropList các thẻ Việc nhỏ (level 2) + "+ Thêm việc nhỏ".
// =====================================================
@Component({
    selector: 'app-board-column',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CdkDropList,
        CdkDrag,
        CdkDragPlaceholder,
        FormsModule,
        NzButtonModule,
        NzDropdownModule,
        NzIconModule,
        NzInputModule,
        TaskCard,
    ],
    host: {
        class: 'board-column',
        role: 'region',
        '[attr.aria-label]': "list().title + ', ' + cards().length + ' việc nhỏ'",
        '[class.is-done]': 'allDone()',
    },
    templateUrl: './board-column.html',
    styleUrl: './board-column.scss',
})
export class BoardColumnComponent {
    readonly list = input.required<TaskListItem>();
    readonly lists = input<TaskListItem[]>([]);
    readonly cards = input<TaskListItem[]>([]);
    readonly pendingIds = input<ReadonlySet<string>>(new Set());

    readonly dropped = output<CardDropEvent>();
    readonly opened = output<TaskListItem>();
    readonly toggled = output<{ card: TaskListItem; done: boolean }>();
    readonly moveBy = output<{ card: TaskListItem; delta: number }>();
    readonly quickAdd = output<QuickAddEvent>();
    readonly renamed = output<string>();
    readonly editInfo = output<void>();
    readonly removed = output<void>();

    protected readonly doneCount = computed(() => this.cards().filter((c) => c.status === TaskStatus.Completed).length);
    protected readonly allDone = computed(() => this.cards().length > 0 && this.doneCount() === this.cards().length);

    // Tên cột sửa tại chỗ
    protected readonly editingTitle = signal(false);
    protected readonly titleDraft = signal('');
    private readonly titleInput = viewChild<ElementRef<HTMLInputElement>>('titleInput');

    // Thêm nhanh việc nhỏ
    protected readonly adding = signal(false);
    protected readonly saving = signal(false);
    protected readonly draft = signal('');
    private readonly addInput = viewChild<ElementRef<HTMLInputElement>>('addInput');

    // Giữ 300ms để kéo trên cảm ứng, chuột kéo ngay.
    protected readonly dragDelay = { touch: 300, mouse: 0 };

    protected onDrop(event: CdkDragDrop<string, string, TaskListItem>): void {
        // Thả trong cùng cột: không lưu thứ tự (sắp theo trạng thái → ưu tiên → hạn).
        if (event.previousContainer === event.container) return;
        this.dropped.emit({ card: event.item.data, toListId: event.container.data });
    }

    protected startRename(): void {
        if (!this.list().canEdit) return;
        this.titleDraft.set(this.list().title);
        this.editingTitle.set(true);
        setTimeout(() => this.titleInput()?.nativeElement.select());
    }

    protected commitRename(): void {
        if (!this.editingTitle()) return;
        this.editingTitle.set(false);
        const title = this.titleDraft().trim();
        if (title && title !== this.list().title) this.renamed.emit(title);
    }

    startAdd(): void {
        this.adding.set(true);
        setTimeout(() => {
            const el = this.addInput()?.nativeElement;
            el?.scrollIntoView?.({ block: 'nearest' });
            el?.focus();
        });
    }

    protected cancelAdd(): void {
        if (this.saving()) return;
        this.adding.set(false);
        this.draft.set('');
    }

    protected submitAdd(): void {
        const title = this.draft().trim();
        if (!title || this.saving()) return;
        this.saving.set(true);
        this.quickAdd.emit({
            listId: this.list().id,
            title,
            done: (ok) => {
                this.saving.set(false);
                if (!ok) return;
                // Giữ ô mở để thêm liên tiếp như Trello.
                this.draft.set('');
                setTimeout(() => this.addInput()?.nativeElement.focus());
            },
        });
    }

    protected isLocked(card: TaskListItem): boolean {
        return !card.canEdit || this.pendingIds().has(card.id);
    }
}

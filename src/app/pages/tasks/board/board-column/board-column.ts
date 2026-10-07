import { CdkDrag, CdkDragDrop, CdkDragPlaceholder, CdkDropList } from '@angular/cdk/drag-drop';
import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { BoardColumn, TaskListItem, TaskStatus } from '../../../../core/models/task.models';
import { taskColumn } from '../../../../shared/utils/status-map';
import { TaskCard } from '../task-card/task-card';

export interface CardDropEvent {
    card: TaskListItem;
    toStatus: TaskStatus;
}

export interface QuickAddEvent {
    title: string;
    status: TaskStatus;
    done: (ok: boolean) => void;
}

// =====================================================
// BoardColumn — một cột Kanban: tiêu đề + số đếm, cdkDropList,
// danh sách thẻ, ô "+ Thêm đầu việc" (gõ tiêu đề rồi Enter).
// Nhận BoardColumn {key,title,status} nên dùng lại được khi
// chuyển sang cột tùy chỉnh (phương án B).
// =====================================================
@Component({
    selector: 'app-board-column',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CdkDropList, CdkDrag, CdkDragPlaceholder, FormsModule, NzButtonModule, NzIconModule, NzInputModule, TaskCard],
    host: {
        class: 'board-column',
        role: 'region',
        '[attr.aria-label]': "column().title + ', ' + cards().length + ' đầu việc'",
        '[attr.data-tone]': 'tone()',
    },
    templateUrl: './board-column.html',
    styleUrl: './board-column.scss',
})
export class BoardColumnComponent {
    readonly column = input.required<BoardColumn>();
    readonly columns = input<BoardColumn[]>([]);
    readonly cards = input<TaskListItem[]>([]);
    readonly pendingIds = input<ReadonlySet<string>>(new Set());
    readonly canAdd = input(false);

    readonly dropped = output<CardDropEvent>();
    readonly opened = output<TaskListItem>();
    readonly moveTo = output<CardDropEvent>();
    readonly moveBy = output<{ card: TaskListItem; delta: number }>();
    readonly quickAdd = output<QuickAddEvent>();

    protected readonly adding = signal(false);
    protected readonly saving = signal(false);
    protected readonly draft = signal('');
    private readonly addInput = viewChild<ElementRef<HTMLInputElement>>('addInput');

    protected tone(): string {
        return taskColumn(this.column().status).tone;
    }

    // Giữ 300ms để kéo trên cảm ứng, chuột kéo ngay.
    protected readonly dragDelay = { touch: 300, mouse: 0 };

    protected onDrop(event: CdkDragDrop<TaskStatus, TaskStatus, TaskListItem>): void {
        // Thả trong cùng cột: phương án A không lưu thứ tự (sắp theo ưu tiên → hạn).
        if (event.previousContainer === event.container) return;
        this.dropped.emit({ card: event.item.data, toStatus: event.container.data });
    }

    startAdd(): void {
        this.adding.set(true);
        setTimeout(() => {
            const el = this.addInput()?.nativeElement;
            el?.scrollIntoView({ block: 'nearest' });
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
            title,
            status: this.column().status,
            done: (ok) => {
                this.saving.set(false);
                if (!ok) return;
                // Giữ ô mở để thêm liên tiếp nhiều thẻ như Trello.
                this.draft.set('');
                queueMicrotask(() => this.addInput()?.nativeElement.focus());
            },
        });
    }

    protected isLocked(card: TaskListItem): boolean {
        return !card.canEdit || this.pendingIds().has(card.id);
    }
}

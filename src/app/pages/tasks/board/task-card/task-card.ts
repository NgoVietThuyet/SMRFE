import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { BoardColumn, TaskListItem, TaskPriority, TaskStatus } from '../../../../core/models/task.models';
import { Avatar } from '../../../../shared/ui/avatar/avatar';
import { dueClass, priorityLabel, shortDate } from '../../../../shared/utils/task-format';

// =====================================================
// TaskCard — mặt thẻ Đầu việc trên bảng Kanban.
// Dải ưu tiên · tiêu đề (2 dòng) · ☑ x/y việc nhỏ · hạn · người phụ trách.
// Bàn phím: Enter mở chi tiết, Shift+←/→ chuyển cột kề bên.
// =====================================================
@Component({
    selector: 'app-task-card',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [Avatar, NzDropdownModule, NzIconModule, NzTooltipModule],
    host: {
        class: 'task-card',
        tabindex: '0',
        role: 'button',
        '[class.is-pending]': 'pending()',
        '[class.is-locked]': '!card().canEdit',
        '[class.is-high]': 'card().priority === TaskPriority.High',
        '[class.is-low]': 'card().priority === TaskPriority.Low',
        '[attr.aria-label]': 'ariaLabel()',
        '[attr.aria-busy]': 'pending() || null',
        '(click)': 'opened.emit()',
        '(keydown.enter)': 'opened.emit()',
        '(keydown.shift.arrowright)': 'onShift($event, 1)',
        '(keydown.shift.arrowleft)': 'onShift($event, -1)',
    },
    template: `
        <div class="task-card__top">
            @if (card().priority !== TaskPriority.Medium) {
                <span class="task-card__prio">{{ priorityText() }}</span>
            }
            @if (card().canEdit) {
                <button type="button" class="task-card__menu" nz-dropdown [nzDropdownMenu]="menu" nzTrigger="click"
                    nzPlacement="bottomRight" [attr.aria-label]="'Chuyển ' + card().title + ' sang cột khác'"
                    (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()" [disabled]="pending()">
                    <span nz-icon nzType="more" nzTheme="outline"></span>
                </button>
                <nz-dropdown-menu #menu="nzDropdownMenu">
                    <ul nz-menu>
                        @for (col of columns(); track col.key) {
                            @if (col.status !== card().status) {
                                <li nz-menu-item (click)="moveTo.emit(col.status)">Chuyển sang “{{ col.title }}”</li>
                            }
                        }
                    </ul>
                </nz-dropdown-menu>
            } @else {
                <span class="task-card__lock" nz-tooltip nzTooltipTitle="Bạn chỉ có quyền xem đầu việc này"
                    aria-label="Chỉ xem">
                    <span nz-icon nzType="lock" nzTheme="outline"></span>
                </span>
            }
        </div>
        <h3 class="task-card__title">{{ card().title }}</h3>
        <div class="task-card__meta">
            @if (card().childrenCount > 0) {
                <span class="task-card__check" [class.is-done]="allDone()"
                    [attr.aria-label]="card().completedChildrenCount + ' trên ' + card().childrenCount + ' việc nhỏ đã xong'">
                    <span nz-icon nzType="check-square" nzTheme="outline"></span>
                    {{ card().completedChildrenCount }}/{{ card().childrenCount }}
                </span>
            }
            @if (card().dueDate) {
                <span class="task-card__due" [class.is-overdue]="dueTone() === 'is-overdue'" [class.is-due-soon]="dueTone() === 'is-due-soon'">
                    <span nz-icon nzType="clock-circle" nzTheme="outline"></span>
                    {{ dueText() }}
                </span>
            }
            <span class="task-card__spacer"></span>
            @if (card().assigneeUserName) {
                <smr-avatar [name]="card().assigneeFullName || card().assigneeUserName" size="xs" />
            }
        </div>
        @if (pending()) {
            <span class="task-card__spinner" aria-hidden="true"></span>
        }
    `,
    styleUrl: './task-card.scss',
})
export class TaskCard {
    readonly TaskPriority = TaskPriority;

    readonly card = input.required<TaskListItem>();
    readonly columns = input<BoardColumn[]>([]);
    readonly pending = input(false);

    readonly opened = output<void>();
    readonly moveTo = output<TaskStatus>();
    readonly moveBy = output<number>();

    protected readonly priorityText = computed(() => priorityLabel(this.card().priority));
    protected readonly dueText = computed(() => shortDate(this.card().dueDate));
    protected readonly dueTone = computed(() => dueClass(this.card().dueDate, this.card().status));
    protected readonly allDone = computed(
        () => this.card().childrenCount > 0 && this.card().completedChildrenCount === this.card().childrenCount
    );
    protected readonly ariaLabel = computed(() => {
        const c = this.card();
        const parts = [c.title];
        if (c.childrenCount) parts.push(`${c.completedChildrenCount}/${c.childrenCount} việc nhỏ`);
        if (c.dueDate) parts.push(`hạn ${shortDate(c.dueDate)}`);
        if (c.canEdit) parts.push('Shift + mũi tên trái/phải để chuyển cột');
        return parts.join(', ');
    });

    protected onShift(event: Event, delta: number): void {
        event.preventDefault();
        if (this.card().canEdit && !this.pending()) this.moveBy.emit(delta);
    }
}

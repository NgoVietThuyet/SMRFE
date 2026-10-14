import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { TaskListItem, TaskPriority, TaskStatus } from '../../../../core/models/task.models';
import { Avatar } from '../../../../shared/ui/avatar/avatar';
import { taskStatus } from '../../../../shared/utils/status-map';
import { dueClass, priorityLabel, shortDate } from '../../../../shared/utils/task-format';

// =====================================================
// TaskCard — thẻ Việc nhỏ (level 2) trong một cột Đầu việc.
// Ô tick hoàn thành · tiêu đề (2 dòng) · trạng thái · hạn · người phụ trách.
// Bàn phím: Enter mở chi tiết, Shift+←/→ chuyển sang cột kề bên.
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
        '[class.is-done]': 'done()',
        '[class.is-high]': 'card().priority === TaskPriority.High',
        '[attr.aria-label]': 'ariaLabel()',
        '[attr.aria-busy]': 'pending() || null',
        '(click)': 'opened.emit()',
        '(keydown.enter)': 'opened.emit()',
        '(keydown.shift.arrowright)': 'onShift($event, 1)',
        '(keydown.shift.arrowleft)': 'onShift($event, -1)',
    },
    template: `
        <div class="task-card__row">
            <button type="button" class="task-card__check" role="checkbox" [attr.aria-checked]="done()"
                [disabled]="!card().canEdit || pending()"
                [attr.aria-label]="(done() ? 'Bỏ hoàn thành ' : 'Đánh dấu hoàn thành ') + card().title"
                (click)="$event.stopPropagation(); toggled.emit(!done())" (keydown.enter)="$event.stopPropagation()">
            </button>
            <h3 class="task-card__title">{{ card().title }}</h3>
            @if (card().canEdit) {
                <button type="button" class="task-card__menu" nz-dropdown [nzDropdownMenu]="menu" nzTrigger="click"
                    nzPlacement="bottomRight" [attr.aria-label]="'Chuyển ' + card().title + ' sang đầu việc khác'"
                    (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()" [disabled]="pending()">
                    <span nz-icon nzType="more" nzTheme="outline"></span>
                </button>
                <nz-dropdown-menu #menu="nzDropdownMenu">
                    <ul nz-menu>
                        @for (l of otherLists(); track l.id) {
                            <li nz-menu-item (click)="moveTo.emit(l.id)">Chuyển sang “{{ l.title }}”</li>
                        } @empty {
                            <li nz-menu-item nzDisabled>Chưa có đầu việc khác</li>
                        }
                    </ul>
                </nz-dropdown-menu>
            } @else {
                <span class="task-card__lock" nz-tooltip nzTooltipTitle="Bạn chỉ có quyền xem việc nhỏ này" aria-label="Chỉ xem">
                    <span nz-icon nzType="lock" nzTheme="outline"></span>
                </span>
            }
        </div>
        @if (hasMeta()) {
            <div class="task-card__meta">
                @if (card().priority === TaskPriority.High) {
                    <span class="task-card__prio">{{ priorityText() }}</span>
                }
                @if (card().status === TaskStatus.InProgress) {
                    <span class="task-card__status">{{ statusText() }}</span>
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
        }
        @if (pending()) {
            <span class="task-card__spinner" aria-hidden="true"></span>
        }
    `,
    styleUrl: './task-card.scss',
})
export class TaskCard {
    readonly TaskPriority = TaskPriority;
    readonly TaskStatus = TaskStatus;

    readonly card = input.required<TaskListItem>();
    /** Các cột (Đầu việc) của bảng — cho menu "Chuyển sang…". */
    readonly lists = input<TaskListItem[]>([]);
    readonly pending = input(false);

    readonly opened = output<void>();
    readonly toggled = output<boolean>();
    readonly moveTo = output<string>();
    readonly moveBy = output<number>();

    protected readonly done = computed(() => this.card().status === TaskStatus.Completed);
    protected readonly otherLists = computed(() => this.lists().filter((l) => l.id !== this.card().parentId));
    protected readonly priorityText = computed(() => priorityLabel(this.card().priority));
    protected readonly statusText = computed(() => taskStatus(this.card().status).label);
    protected readonly dueText = computed(() => shortDate(this.card().dueDate));
    protected readonly dueTone = computed(() => dueClass(this.card().dueDate, this.card().status));
    protected readonly hasMeta = computed(() => {
        const c = this.card();
        return c.priority === TaskPriority.High || c.status === TaskStatus.InProgress || !!c.dueDate || !!c.assigneeUserName;
    });
    protected readonly ariaLabel = computed(() => {
        const c = this.card();
        const parts = [c.title, taskStatus(c.status).label];
        if (c.dueDate) parts.push(`hạn ${shortDate(c.dueDate)}`);
        if (c.canEdit) parts.push('Shift + mũi tên trái/phải để chuyển đầu việc');
        return parts.join(', ');
    });

    protected onShift(event: Event, delta: number): void {
        event.preventDefault();
        if (this.card().canEdit && !this.pending()) this.moveBy.emit(delta);
    }
}

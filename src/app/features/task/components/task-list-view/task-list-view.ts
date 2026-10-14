import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { BoardCard, TaskLabel } from '../../models/task.models';
import { CardGroup, TaskUi } from '../../utils/task-ui';

/**
 * Dạng Danh sách (mẫu features/task/components/task-list-view của 2.FrontEnd, kiểu ClickUp):
 * nhóm theo cột (hoặc theo nhóm ở lối tắt), cột Nhiệm vụ · Người thực hiện · Ngày hết hạn · Checklist.
 */
@Component({
  selector: 'app-task-list-view',
  standalone: true,
  imports: [SharedModules],
  templateUrl: './task-list-view.html',
  styleUrl: './task-list-view.scss',
})
export class TaskListView {
  @Input() groups: CardGroup[] = [];
  @Input() labels: TaskLabel[] = [];
  @Input() title = 'Danh sách nhiệm vụ';
  /** Có được thêm thẻ / thêm danh sách (quyền Sửa bảng). */
  @Input() canEdit = false;
  @Output() cardClicked = new EventEmitter<BoardCard>();
  @Output() cardToggleComplete = new EventEmitter<BoardCard>();
  @Output() addCard = new EventEmitter<{ listId: string; title: string }>();
  @Output() addList = new EventEmitter<string>();

  readonly ui = TaskUi;
  collapsedGroups = new Set<string>();
  addingCardListId = '';
  newCardTitle = '';
  isAddingList = false;
  newListName = '';

  get total(): number {
    return this.groups.reduce((n, g) => n + g.cards.length, 0);
  }

  toggleGroup(id: string): void {
    this.collapsedGroups.has(id) ? this.collapsedGroups.delete(id) : this.collapsedGroups.add(id);
  }

  startAddCard(listId: string): void {
    this.addingCardListId = listId;
    this.newCardTitle = '';
    setTimeout(() => document.getElementById('new-card-input-lv-' + listId)?.focus());
  }

  submitAddCard(listId: string): void {
    const title = this.newCardTitle.trim();
    if (!title) return;
    this.addCard.emit({ listId, title });
    this.newCardTitle = '';
  }

  cancelAddCard(): void {
    this.addingCardListId = '';
    this.newCardTitle = '';
  }

  onKeydownCard(e: KeyboardEvent, listId: string): void {
    if (e.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      this.submitAddCard(listId);
    } else if (e.key === 'Escape') {
      this.cancelAddCard();
    }
  }

  startAddList(): void {
    this.isAddingList = true;
    this.newListName = '';
    setTimeout(() => document.getElementById('new-list-input-lv')?.focus());
  }

  submitAddList(): void {
    const name = this.newListName.trim();
    if (!name) return;
    this.addList.emit(name);
    this.newListName = '';
    this.isAddingList = false;
  }

  cancelAddList(): void {
    this.isAddingList = false;
  }

  onKeydownList(e: KeyboardEvent): void {
    if (e.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      this.submitAddList();
    } else if (e.key === 'Escape') {
      this.cancelAddList();
    }
  }
}

import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, Subject, finalize, map, of, switchMap, takeUntil } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { DateTimeUtils } from '../../../../shared/utils';
import { BoardList, PRIORITY_LIST, TaskListItem } from '../../../task/models/task.models';
import { TaskService } from '../../../task/services/task.service';
import { Contact } from '../../services/contacts.service';

/**
 * "Giao việc" từ Danh bạ (P15): chọn công việc (bảng mình có quyền sửa) → cột → tạo việc nhỏ giao cho người này.
 * Bảng chưa có cột nào thì tạo cột "Việc cần làm".
 */
@Component({
  selector: 'app-assign-task-modal',
  standalone: true,
  imports: [SharedModules],
  template: `
    <nz-modal [nzVisible]="!!contact" [nzTitle]="'GIAO VIỆC CHO ' + (contact?.fullName || '').toUpperCase()" [nzFooter]="footer"
      (nzOnCancel)="close()" [nzWidth]="520">
      <ng-container *nzModalContent>
        <label class="text-control">Công việc <span class="required-star">*</span></label>
        <nz-select class="space-control full" nzShowSearch [nzLoading]="loadingWorks" [(ngModel)]="workId" (ngModelChange)="loadLists()"
          nzPlaceHolder="Chọn công việc (bảng)" aria-label="Công việc">
          @for (w of works; track w.id) { <nz-option [nzValue]="w.id" [nzLabel]="w.title"></nz-option> }
        </nz-select>
        @if (!loadingWorks && !works.length) {
        <div class="hint">Bạn chưa có công việc nào để giao. <a (click)="goCreate()">Tạo công việc</a></div>
        }

        @if (workId) {
        <label class="text-control">Danh sách (cột)</label>
        <nz-select class="space-control full" [(ngModel)]="listId" [nzLoading]="loadingLists"
          [nzPlaceHolder]="lists.length ? 'Chọn cột' : 'Bảng chưa có cột — sẽ tạo cột Việc cần làm'" aria-label="Danh sách">
          @for (l of lists; track l.id) { <nz-option [nzValue]="l.id" [nzLabel]="l.title"></nz-option> }
        </nz-select>
        }

        <label class="text-control" for="assign-title">Tên việc <span class="required-star">*</span></label>
        <input id="assign-title" nz-input class="space-control" maxlength="300" [(ngModel)]="title" placeholder="VD: Chuẩn bị báo cáo quý" />

        <div class="row">
          <div class="col">
            <label class="text-control">Hạn hoàn thành</label>
            <nz-date-picker class="full" nzShowTime nzFormat="dd/MM/yyyy HH:mm" [(ngModel)]="due" aria-label="Hạn hoàn thành"></nz-date-picker>
          </div>
          <div class="col">
            <label class="text-control">Ưu tiên</label>
            <nz-select class="full" [(ngModel)]="priority" aria-label="Ưu tiên">
              @for (p of priorities; track p.value) { <nz-option [nzValue]="p.value" [nzLabel]="p.label"></nz-option> }
            </nz-select>
          </div>
        </div>
        @if (error) { <div class="field-error">{{ error }}</div> }
      </ng-container>
      <ng-template #footer>
        <button nz-button (click)="close()">Hủy</button>
        <button nz-button nzType="primary" [nzLoading]="saving" (click)="save()"><nz-icon nzType="send" /> Giao việc</button>
      </ng-template>
    </nz-modal>
  `,
  styles: [`
    .full { width: 100%; }
    .hint { color: #8c8c8c; font-size: 12px; margin: -6px 0 10px; }
    .row { display: flex; gap: 12px; }
    .col { flex: 1; min-width: 0; }
  `],
})
export class AssignTaskModal implements OnChanges, OnDestroy {
  @Input() contact: Contact | null = null;
  @Output() contactChange = new EventEmitter<Contact | null>();
  /** Giao xong — trang cha hiện link "Mở việc vừa giao". */
  @Output() assigned = new EventEmitter<{ workId: string; cardId: string }>();

  private destroy$ = new Subject<void>();
  readonly priorities = PRIORITY_LIST;
  works: TaskListItem[] = [];
  lists: BoardList[] = [];
  workId: string | null = null;
  listId: string | null = null;
  title = '';
  due: Date | null = null;
  priority = 1;
  error = '';
  saving = false;
  loadingWorks = false;
  loadingLists = false;

  constructor(private tasks: TaskService, private router: Router, private message: NzMessageService) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['contact']?.currentValue) {
      this.title = '';
      this.due = null;
      this.priority = 1;
      this.error = '';
      this.listId = null;
      this.loadWorks();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadWorks(): void {
    this.loadingWorks = true;
    this.tasks.query({ level: 0, pageSize: 100 })
      .pipe(finalize(() => this.loadingWorks = false), takeUntil(this.destroy$))
      .subscribe(res => {
        this.works = (res?.items ?? []).filter(w => w.canEdit)
          .sort((a, b) => (b.updateDate ?? '').localeCompare(a.updateDate ?? ''));
        if (!this.works.some(w => w.id === this.workId)) this.workId = this.works[0]?.id ?? null;
        this.loadLists();
      });
  }

  loadLists(): void {
    this.lists = [];
    this.listId = null;
    if (!this.workId) return;
    this.loadingLists = true;
    this.tasks.board(this.workId).pipe(finalize(() => this.loadingLists = false), takeUntil(this.destroy$)).subscribe(b => {
      this.lists = b.lists;
      this.listId = this.lists[0]?.id ?? null;
    });
  }

  save(): void {
    const title = this.title.trim();
    if (!this.workId) {
      this.error = 'Vui lòng chọn công việc';
      return;
    }
    if (!title) {
      this.error = 'Vui lòng nhập tên việc';
      return;
    }
    if (!this.contact || this.saving) return;
    this.error = '';
    this.saving = true;
    const workId = this.workId;
    const list$: Observable<string> = this.listId
      ? of(this.listId)
      : this.tasks.create({ parentId: workId, level: 1, title: 'Việc cần làm' }, false).pipe(map(l => l.id));
    list$.pipe(
      switchMap(parentId => this.tasks.create({
        parentId, level: 2, title, assigneeUserName: this.contact!.userName, priority: this.priority,
        dueDate: this.due ? DateTimeUtils.toUtc(this.due) : null,
      }, false)),
      finalize(() => this.saving = false),
      takeUntil(this.destroy$),
    ).subscribe(card => {
      this.message.success(`Đã giao việc cho ${this.contact?.fullName}`);
      this.assigned.emit({ workId, cardId: card.id });
      this.close();
    });
  }

  goCreate(): void {
    this.close();
    this.router.navigate(['/tasks'], { queryParams: { create: 1 } });
  }

  close(): void {
    this.contactChange.emit(null);
  }
}

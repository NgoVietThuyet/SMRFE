import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzUploadFile } from 'ng-zorro-antd/upload';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { SessionService } from '../../../../core';
import { DateTimeUtils, FileUtils } from '../../../../shared/utils';
import { UserSearchItem } from '../../../meeting/models/meeting.models';
import { MeetingService } from '../../../meeting/services/meeting.service';
import { CardDetail, ChecklistItem, LABEL_COLORS, PRIORITY_LIST, TaskLabel, TaskStatus, UpdateTaskDto, priorityMeta } from '../../models/task.models';
import { TaskService, cardUpdate } from '../../services/task.service';
import { TaskUi } from '../../utils/task-ui';

/**
 * Modal chi tiết việc (mẫu features/task/components/card-detail của 2.FrontEnd, rộng 900px).
 * Trái: tiêu đề, nhãn, Mô tả, Checklist, Đính kèm, Bình luận. Phải: THÊM VÀO THẺ · THÔNG TIN · THAO TÁC.
 * Mọi thay đổi lưu ngay; đóng modal báo `closed(true)` nếu có thay đổi để bảng tải lại.
 */
import { UploadPolicyService } from '../../../../shared/services';
@Component({
  selector: 'app-card-detail',
  standalone: true,
  imports: [SharedModules, NzProgressModule],
  templateUrl: './card-detail.html',
  styleUrl: './card-detail.scss',
})
export class CardDetailModal implements OnInit, OnChanges, OnDestroy {
  @Input() taskId: string | null = null;
  @Output() closed = new EventEmitter<boolean>();
  @Output() deleted = new EventEmitter<string>();

  private destroy$ = new Subject<void>();
  readonly search$ = new Subject<string>();
  readonly ui = TaskUi;
  readonly priorityList = PRIORITY_LIST;
  readonly priorityMeta = priorityMeta;
  readonly labelColors = LABEL_COLORS;
  readonly TaskStatus = TaskStatus;

  detail: CardDetail | null = null;
  loading = false;
  private changed = false;
  me = '';
  meName = '';

  isEditingTitle = false;
  editTitle = '';
  isEditingDesc = false;
  editDesc = '';

  isAssigneeVisible = false;
  isLabelPopoverVisible = false;
  isChecklistPopoverVisible = false;
  isDueDateVisible = false;
  isPriorityVisible = false;

  users: UserSearchItem[] = [];
  searching = false;
  newLabelName = '';
  newLabelColor = LABEL_COLORS[0].color;
  newItemContent = '';
  newChecklistItem = '';
  addingItem = false;
  newComment = '';
  selectedDateRange: Date[] = [];

  isUploadVisible = false;
  uploadFileList: NzUploadFile[] = [];
  uploading = false;

  constructor(
    private service: TaskService,
    private meetings: MeetingService,
    private session: SessionService,
    private message: NzMessageService,
    readonly uploadPolicy: UploadPolicyService,
  ) { }

  ngOnInit(): void {
    const info = this.session.accountInfo;
    this.me = info?.userName ?? '';
    this.meName = info?.fullName || this.me;
    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => {
        this.searching = true;
        return this.meetings.searchUsers(q.trim(), 10).pipe(finalize(() => this.searching = false));
      }),
      takeUntil(this.destroy$),
    ).subscribe(list => this.users = list ?? []);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['taskId'] && this.taskId) {
      this.changed = false;
      this.detail = null;
      this.load();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get visible(): boolean {
    return !!this.taskId;
  }

  get card() {
    return this.detail!.card;
  }

  get canEdit(): boolean {
    return !!this.detail?.canEdit;
  }

  get canWork(): boolean {
    return !!this.detail?.card.canWork;
  }

  load(): void {
    if (!this.taskId) return;
    this.loading = true;
    this.service.card(this.taskId).pipe(finalize(() => this.loading = false), takeUntil(this.destroy$)).subscribe({
      next: d => {
        this.detail = d;
        const s = DateTimeUtils.fromUtc(d.card.startDate);
        const e = DateTimeUtils.fromUtc(d.card.dueDate);
        this.selectedDateRange = s && e ? [s, e] : e ? [e, e] : [];
      },
      error: () => this.close(),
    });
  }

  close(): void {
    this.closed.emit(this.changed);
  }

  private mark(): void {
    this.changed = true;
  }

  /** PUT Task với đủ trường chính (BE yêu cầu) rồi cập nhật lại thẻ trên modal. */
  private save(patch: Partial<UpdateTaskDto>, after?: () => void): void {
    if (!this.detail) return;
    this.service.update(this.card.id, cardUpdate(this.card, patch)).pipe(takeUntil(this.destroy$)).subscribe(t => {
      Object.assign(this.detail!.card, {
        title: t.title, description: t.description ?? null, assigneeUserName: t.assigneeUserName,
        assigneeFullName: t.assigneeFullName, dueDate: t.dueDate, startDate: t.startDate ?? null,
        status: t.status, priority: t.priority, isArchived: !!t.isArchived,
      });
      this.mark();
      after?.();
    });
  }

  // ===================== Tiêu đề / mô tả =====================

  startEditTitle(): void {
    if (!this.canEdit) return;
    this.editTitle = this.card.title;
    this.isEditingTitle = true;
  }

  saveTitle(): void {
    const title = this.editTitle.trim();
    if (!title || title === this.card.title) {
      this.isEditingTitle = false;
      return;
    }
    this.save({ title }, () => this.isEditingTitle = false);
  }

  startEditDesc(): void {
    if (!this.canEdit) return;
    this.editDesc = this.card.description ?? '';
    this.isEditingDesc = true;
  }

  saveDesc(): void {
    this.save({ description: this.editDesc.trim() || null }, () => this.isEditingDesc = false);
  }

  // ===================== Trạng thái / ưu tiên / thời gian / người thực hiện =====================

  setStatus(status: TaskStatus): void {
    if (!this.canWork || this.card.status === status) return;
    this.service.setStatus(this.card.id, status).pipe(takeUntil(this.destroy$)).subscribe(t => {
      this.card.status = t.status;
      this.mark();
    });
  }

  setPriority(p: number): void {
    this.isPriorityVisible = false;
    if (this.card.priority !== p) this.save({ priority: p });
  }

  onDateRangeChange(range: Date[] | null): void {
    if (!range || range.length < 2 || !range[0] || !range[1]) return;
    this.isDueDateVisible = false;
    this.save({ startDate: DateTimeUtils.toUtc(range[0]), dueDate: DateTimeUtils.toUtc(range[1]) });
  }

  removeDateRange(): void {
    this.isDueDateVisible = false;
    this.selectedDateRange = [];
    this.save({ dueDate: null, clearDates: true });
  }

  setAssignee(userName: string | null): void {
    this.isAssigneeVisible = false;
    if ((this.card.assigneeUserName ?? null) === userName) return;
    this.save({ assigneeUserName: userName });
  }

  onAssigneeOpen(open: boolean): void {
    if (open && !this.users.length) this.search$.next('');
  }

  // ===================== Nhãn =====================

  isLabelActive(l: TaskLabel): boolean {
    return this.card.labelIds.includes(l.id);
  }

  toggleLabel(l: TaskLabel): void {
    if (!this.canEdit) return;
    const ids = this.isLabelActive(l) ? this.card.labelIds.filter(x => x !== l.id) : [...this.card.labelIds, l.id];
    this.service.setCardLabels(this.card.id, ids).pipe(takeUntil(this.destroy$)).subscribe(saved => {
      this.card.labelIds = saved ?? [];
      this.mark();
    });
  }

  createLabel(): void {
    if (!this.canEdit || !this.detail) return;
    this.service.createLabel(this.detail.workId, this.newLabelName.trim(), this.newLabelColor)
      .pipe(takeUntil(this.destroy$))
      .subscribe(l => {
        this.detail!.labels = [...this.detail!.labels, l];
        this.newLabelName = '';
        this.toggleLabel(l);
      });
  }

  deleteLabel(l: TaskLabel, e: Event): void {
    e.stopPropagation();
    this.service.deleteLabel(l.id).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.detail!.labels = this.detail!.labels.filter(x => x.id !== l.id);
      this.card.labelIds = this.card.labelIds.filter(x => x !== l.id);
      this.mark();
    });
  }

  get cardLabels(): TaskLabel[] {
    return this.detail ? this.detail.labels.filter(l => this.card.labelIds.includes(l.id)) : [];
  }

  // ===================== Checklist =====================

  get checklistPercent(): number {
    const list = this.detail?.checklist ?? [];
    return list.length ? Math.round(list.filter(i => i.isDone).length * 100 / list.length) : 0;
  }

  private syncChecklistBadge(): void {
    const list = this.detail!.checklist;
    this.card.checklistTotal = list.length;
    this.card.checklistDone = list.filter(i => i.isDone).length;
    this.mark();
  }

  addItem(content: string = this.newItemContent): void {
    const text = content.trim();
    if (!text || !this.canWork) return;
    this.service.addChecklist(this.card.id, text).pipe(takeUntil(this.destroy$)).subscribe(item => {
      this.detail!.checklist = [...this.detail!.checklist, item];
      this.newItemContent = '';
      this.newChecklistItem = '';
      this.isChecklistPopoverVisible = false;
      this.syncChecklistBadge();
    });
  }

  toggleItem(item: ChecklistItem): void {
    if (!this.canWork) return;
    this.service.updateChecklist(item.id, { done: !item.isDone }).pipe(takeUntil(this.destroy$)).subscribe(saved => {
      item.isDone = saved.isDone;
      this.syncChecklistBadge();
    });
  }

  deleteItem(item: ChecklistItem): void {
    this.service.deleteChecklist(item.id).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.detail!.checklist = this.detail!.checklist.filter(i => i.id !== item.id);
      this.syncChecklistBadge();
    });
  }

  onKeydownAddItem(e: KeyboardEvent): void {
    if (e.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      this.addItem();
    } else if (e.key === 'Escape') {
      this.addingItem = false;
    }
  }

  // ===================== Đính kèm =====================

  beforeUpload = (file: NzUploadFile): boolean => {
    // Kiểm tra theo Cấu hình hệ thống trước khi đưa vào danh sách chờ tải (BE kiểm tra lại).
    const error = this.uploadPolicy.check(file as unknown as File);
    if (error) {
      this.message.warning(`${file.name}: ${error}`);
      return false;
    }
    this.uploadFileList = [...this.uploadFileList, file];
    return false;
  };

  confirmUpload(): void {
    const files = this.uploadFileList.map(f => (f.originFileObj ?? f) as unknown as File);
    if (!files.length || this.uploading) return;
    this.uploading = true;
    const next = (i: number) => {
      if (i >= files.length) {
        this.uploading = false;
        this.uploadFileList = [];
        this.isUploadVisible = false;
        return;
      }
      this.service.uploadFile(this.card.id, files[i]).pipe(takeUntil(this.destroy$)).subscribe({
        next: f => {
          this.detail!.files = [f, ...this.detail!.files];
          this.card.fileCount = this.detail!.files.length;
          this.mark();
          next(i + 1);
        },
        error: () => next(i + 1),
      });
    };
    next(0);
  }

  download(fileId: string): void {
    this.service.downloadUrl(fileId).pipe(takeUntil(this.destroy$)).subscribe(r => {
      if (r?.url) window.open(r.url, '_blank', 'noopener');
    });
  }

  removeFile(fileId: string): void {
    this.service.deleteFile(fileId).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.detail!.files = this.detail!.files.filter(f => f.id !== fileId);
      this.card.fileCount = this.detail!.files.length;
      this.mark();
    });
  }

  fileSize(bytes: number): string {
    return FileUtils.getHumanFileSize(Number(bytes) || 0, 1);
  }

  fileIcon(name: string): string {
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (ext === 'pdf') return 'file-pdf';
    if (['doc', 'docx'].includes(ext)) return 'file-word';
    if (['xls', 'xlsx', 'csv'].includes(ext)) return 'file-excel';
    if (['png', 'jpg', 'jpeg'].includes(ext)) return 'file-image';
    return 'file';
  }

  // ===================== Bình luận =====================

  submitComment(): void {
    const text = this.newComment.trim();
    if (!text || !this.canWork) return;
    this.service.addComment(this.card.id, text).pipe(takeUntil(this.destroy$)).subscribe(c => {
      this.detail!.comments = [...this.detail!.comments, c];
      this.card.commentCount = this.detail!.comments.length;
      this.newComment = '';
      this.mark();
    });
  }

  onKeydownComment(e: KeyboardEvent): void {
    if (e.isComposing) return;
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.submitComment();
    }
  }

  deleteComment(id: string): void {
    this.service.deleteComment(id).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.detail!.comments = this.detail!.comments.filter(c => c.id !== id);
      this.card.commentCount = this.detail!.comments.length;
      this.mark();
    });
  }

  // ===================== Thao tác =====================

  archiveCard(): void {
    this.save({ isArchived: !this.card.isArchived }, () =>
      this.message.success(this.card.isArchived ? 'Đã lưu trữ thẻ' : 'Đã khôi phục thẻ'));
  }

  deleteCard(): void {
    const id = this.card.id;
    this.service.remove(id).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.deleted.emit(id);
      this.changed = true;
      this.close();
    });
  }
}

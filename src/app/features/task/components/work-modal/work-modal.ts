import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { Subject, finalize, takeUntil } from 'rxjs';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { MeetingListItem } from '../../../meeting/models/meeting.models';
import { MeetingService } from '../../../meeting/services/meeting.service';
import { BACKGROUND_COLOR_DEFAULT, BOARD_BACKGROUNDS, TaskListItem } from '../../models/task.models';
import { TaskService, cardUpdate } from '../../services/task.service';

/**
 * Modal tạo / sửa Công việc cấp 0 (mẫu modal "Tạo Bảng mới" của task-home 2.FrontEnd):
 * xem trước màu, 12 màu + màu tự chọn, tên, mô tả, cuộc họp (tuỳ chọn), công khai.
 */
@Component({
  selector: 'app-work-modal',
  standalone: true,
  imports: [SharedModules],
  template: `
    <nz-modal [nzVisible]="visible" [nzTitle]="work ? 'Chỉnh sửa công việc' : 'Tạo công việc mới'" [nzFooter]="footer"
      (nzOnCancel)="close()" nzClassName="work-modal">
      <ng-container *nzModalContent>
        <div class="modal-form">
          <div class="board-preview" [style.background]="color">
            <div class="preview-label">{{ name || 'Tên công việc' }}</div>
          </div>

          <div class="form-item">
            <label class="form-label">Màu nền</label>
            <div class="color-picker">
              @for (c of backgrounds; track c) {
              <div class="color-swatch" [style.background]="c" [class.selected]="color === c" (click)="color = c"
                role="button" [attr.aria-label]="'Màu ' + c">
                @if (color === c) { <nz-icon nzType="check" style="color:white" /> }
              </div>
              }
              <div class="color-swatch custom-color" (click)="colorInput.click()" nz-tooltip nzTooltipTitle="Màu khác">
                <nz-icon nzType="highlight" style="font-size: 18px;" />
                <input #colorInput type="color" [value]="color" (input)="onCustomColor($event)" style="opacity: 0; width: 0; height: 0;" />
              </div>
            </div>
          </div>

          <div class="form-item">
            <label class="form-label" for="work-name">Tên công việc <span class="required-star">*</span></label>
            <input id="work-name" nz-input [(ngModel)]="name" maxlength="300" placeholder="VD: Triển khai hệ thống họp trực tuyến" />
            @if (error) { <div class="field-error">{{ error }}</div> }
          </div>

          <div class="form-item">
            <label class="form-label" for="work-desc">Mô tả</label>
            <textarea id="work-desc" nz-input [(ngModel)]="description" maxlength="4000" placeholder="Mô tả công việc..."
              [nzAutosize]="{ minRows: 2, maxRows: 4 }"></textarea>
          </div>

          @if (!work) {
          <div class="form-item">
            <label class="form-label">Cuộc họp</label>
            <nz-select class="full-width" [(ngModel)]="meetingId" nzAllowClear nzShowSearch nzPlaceHolder="Không thuộc cuộc họp nào"
              [nzLoading]="loadingMeetings" aria-label="Cuộc họp">
              @for (m of meetings; track m.id) { <nz-option [nzValue]="m.id" [nzLabel]="m.name"></nz-option> }
            </nz-select>
          </div>
          } @else if (work.meetingName) {
          <div class="form-item"><label class="form-label">Cuộc họp</label><div>{{ work.meetingName }}</div></div>
          }

          @if (!work) {
          <div class="form-item">
            <label nz-checkbox [(ngModel)]="isPublic">Công việc công khai (mọi người xem được)</label>
          </div>
          }
        </div>
      </ng-container>
      <ng-template #footer>
        <button nz-button (click)="close()">Hủy</button>
        <button nz-button nzType="primary" [nzLoading]="saving" (click)="save()">{{ work ? 'Cập nhật' : 'Tạo mới' }}</button>
      </ng-template>
    </nz-modal>
  `,
  styleUrl: '../task-home/task-home.scss',
})
export class WorkModal implements OnChanges, OnDestroy {
  @Input() visible = false;
  /** null = tạo mới. */
  @Input() work: TaskListItem | null = null;
  @Input() presetMeetingId: string | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<TaskListItem>();

  private destroy$ = new Subject<void>();
  readonly backgrounds = BOARD_BACKGROUNDS;
  name = '';
  description = '';
  color = BACKGROUND_COLOR_DEFAULT;
  meetingId: string | null = null;
  isPublic = false;
  error = '';
  saving = false;
  meetings: MeetingListItem[] = [];
  loadingMeetings = false;

  constructor(private service: TaskService, private meetingService: MeetingService) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue) {
      this.error = '';
      this.name = this.work?.title ?? '';
      this.description = this.work?.description ?? '';
      this.color = this.work?.color || BACKGROUND_COLOR_DEFAULT;
      this.meetingId = this.work?.meetingId ?? this.presetMeetingId;
      this.isPublic = !!this.work?.isPublic;
      if (!this.work && !this.meetings.length) this.loadMeetings();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadMeetings(): void {
    this.loadingMeetings = true;
    // Cuộc họp mình tham gia (đang / sắp / đã diễn ra) — BE chỉ cho tạo công việc của cuộc họp mình là thành viên.
    this.meetingService.query({ tab: 'all', pageSize: 100 }, false)
      .pipe(finalize(() => this.loadingMeetings = false), takeUntil(this.destroy$))
      .subscribe(res => this.meetings = (res?.items ?? []).filter(m => m.status !== 0 && m.status !== 4));
  }

  onCustomColor(e: Event): void {
    this.color = (e.target as HTMLInputElement).value.toUpperCase();
  }

  save(): void {
    const title = this.name.trim();
    if (!title) {
      this.error = 'Vui lòng nhập tên công việc';
      return;
    }
    if (this.saving) return;
    this.saving = true;
    const request$ = this.work
      ? this.service.update(this.work.id, cardUpdate({
        title: this.work.title, description: this.work.description ?? null, assigneeUserName: this.work.assigneeUserName,
        dueDate: this.work.dueDate, status: this.work.status, priority: this.work.priority,
      }, { title, description: this.description.trim() || null, color: this.color }), true)
      : this.service.create({
        title, description: this.description.trim() || null, color: this.color, meetingId: this.meetingId, isPublic: this.isPublic,
      });
    request$.pipe(finalize(() => this.saving = false), takeUntil(this.destroy$)).subscribe(w => {
      this.saved.emit(w);
      this.visibleChange.emit(false);
    });
  }

  close(): void {
    this.visibleChange.emit(false);
  }
}

import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { finalize } from 'rxjs';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { MeetingListItem } from '../../models/meeting.models';
import { MeetingService } from '../../services/meeting.service';

/** Modal hủy cuộc họp: bắt buộc nhập lý do; BE gửi MEETING_CANCELLED cho người được mời. */
@Component({
  selector: 'app-cancel-meeting-modal',
  standalone: true,
  imports: [SharedModules],
  template: `
    <nz-modal [nzVisible]="!!meeting" nzTitle="HỦY CUỘC HỌP" nzOkText="Hủy cuộc họp" nzCancelText="Đóng" nzOkDanger
      [nzOkLoading]="isSaving" (nzOnOk)="submit()" (nzOnCancel)="close()">
      <ng-container *nzModalContent>
        @if (meeting) {
        <p>Cuộc họp: <b>{{ meeting.name }}</b></p>
        <nz-alert class="mb-3" nzType="warning" nzShowIcon
          nzMessage="Người được mời sẽ nhận thông báo kèm lý do. Không thể hoàn tác."></nz-alert>
        <label class="text-control" for="cancel-reason">Lý do hủy <span class="required-star">*</span></label>
        <textarea id="cancel-reason" nz-input rows="3" maxlength="500" [(ngModel)]="reason"
          placeholder="VD: Chủ trì bận công tác đột xuất"></textarea>
        @if (error) {
        <div class="field-error">{{ error }}</div>
        }
        }
      </ng-container>
    </nz-modal>
  `,
})
export class CancelMeetingModal implements OnChanges {
  /** Cuộc họp cần hủy; null = đóng modal. */
  @Input() meeting: MeetingListItem | null = null;
  @Output() meetingChange = new EventEmitter<MeetingListItem | null>();
  @Output() cancelled = new EventEmitter<string>();

  reason = '';
  error = '';
  isSaving = false;

  constructor(private service: MeetingService) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['meeting']?.currentValue) {
      this.reason = '';
      this.error = '';
    }
  }

  submit(): void {
    const reason = this.reason.trim();
    if (!reason) {
      this.error = 'Vui lòng nhập lý do hủy';
      return;
    }
    if (!this.meeting || this.isSaving) return;
    const id = this.meeting.id;
    this.isSaving = true;
    this.service.cancel(id, reason)
      .pipe(finalize(() => this.isSaving = false))
      .subscribe(() => {
        this.cancelled.emit(id);
        this.close();
      });
  }

  close(): void {
    this.meetingChange.emit(null);
  }
}

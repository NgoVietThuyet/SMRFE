import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzQRCodeModule } from 'ng-zorro-antd/qr-code';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { MeetingListItem } from '../../models/meeting.models';
import { copyText, meetingInviteText, meetingJoinLink } from '../../utils/meeting-ui';

/** Modal chia sẻ: mã phòng, link mời, QR, nút sao chép lời mời. */
@Component({
  selector: 'app-share-meeting-modal',
  standalone: true,
  imports: [SharedModules, NzQRCodeModule],
  template: `
    <nz-modal [nzVisible]="!!meeting" nzTitle="MỜI THAM GIA" [nzFooter]="null" (nzOnCancel)="close()" [nzWidth]="440">
      <ng-container *nzModalContent>
        @if (meeting) {
        <div class="share-name">{{ meeting.name }}</div>
        <div class="share-qr">
          <nz-qrcode [nzValue]="link" [nzSize]="180" nzLevel="M"></nz-qrcode>
        </div>
        <label class="text-control">Mã phòng</label>
        <nz-input-group class="space-control" [nzAddOnAfter]="copyCode">
          <input nz-input readonly [value]="meeting.roomCode" aria-label="Mã phòng" />
        </nz-input-group>
        <ng-template #copyCode>
          <a (click)="copy(meeting.roomCode, 'Đã sao chép mã phòng')" aria-label="Sao chép mã phòng"><nz-icon nzType="copy" /></a>
        </ng-template>
        <label class="text-control">Link mời</label>
        <nz-input-group class="space-control" [nzAddOnAfter]="copyLink">
          <input nz-input readonly [value]="link" aria-label="Link mời" />
        </nz-input-group>
        <ng-template #copyLink>
          <a (click)="copy(link, 'Đã sao chép link')" aria-label="Sao chép link"><nz-icon nzType="copy" /></a>
        </ng-template>
        <button nz-button nzType="primary" nzBlock (click)="copy(invite, 'Đã sao chép lời mời')">
          <nz-icon nzType="copy" /> Sao chép lời mời
        </button>
        }
      </ng-container>
    </nz-modal>
  `,
  styles: [`
    .share-name { font-weight: 600; font-size: 15px; margin-bottom: 12px; }
    .share-qr { display: flex; justify-content: center; margin-bottom: 16px; }
  `],
})
export class ShareMeetingModal {
  @Input() meeting: MeetingListItem | null = null;
  @Output() meetingChange = new EventEmitter<MeetingListItem | null>();

  constructor(private message: NzMessageService) { }

  get link(): string {
    return this.meeting ? meetingJoinLink(this.meeting.roomCode) : '';
  }

  get invite(): string {
    return this.meeting ? meetingInviteText(this.meeting) : '';
  }

  copy(text: string, done: string): void {
    copyText(text).then(ok => ok ? this.message.success(done) : this.message.warning('Trình duyệt không cho phép sao chép'));
  }

  close(): void {
    this.meetingChange.emit(null);
  }
}

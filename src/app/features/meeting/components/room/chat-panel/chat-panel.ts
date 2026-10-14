import {
  AfterViewChecked, Component, ElementRef, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges, ViewChild,
} from '@angular/core';
import { Subject, filter, finalize, takeUntil } from 'rxjs';
import { SharedModules } from '../../../../../shared/ng-zorro.module';
import { RealtimeHubService } from '../../../../../shared/services';
import { DateTimeUtils } from '../../../../../shared/utils';
import { ChatMessage, RoomParticipant } from '../../../models/room.models';
import { RoomService } from '../../../services/room.service';

/** Panel Chat: tin chung cho cả phòng + nhắn riêng (khách chỉ gửi tin chung). Tin đến qua hub ReceiveMessage. */
@Component({
  selector: 'app-room-chat-panel',
  standalone: true,
  imports: [SharedModules],
  template: `
    <div class="chat">
      <div class="messages" #list>
        @if (!messages.length) {
        <nz-empty nzNotFoundContent="Chưa có tin nhắn" class="empty"></nz-empty>
        }
        @for (m of messages; track m.id) {
        <div class="msg" [class.mine]="isMine(m)">
          <div class="msg-meta">
            <b>{{ isMine(m) ? 'Bạn' : m.senderFullName }}</b>
            @if (m.receiverUserId) { <nz-tag nzColor="purple" class="private">riêng → {{ isMine(m) ? nameOf(m.receiverUserId) : 'bạn' }}</nz-tag> }
            <span>{{ time(m.createDate) | date: 'HH:mm' }}</span>
          </div>
          <div class="msg-text">{{ m.messageText }}</div>
        </div>
        }
      </div>

      @if (!chatEnabled && !isModerator) {
      <div class="disabled-note"><nz-icon nzType="stop" /> Chủ trì đã tắt chat trong cuộc họp này.</div>
      } @else {
      <div class="composer">
        @if (!isGuest) {
        <nz-select class="to" nzSize="small" [(ngModel)]="to" aria-label="Gửi tới" nzShowSearch>
          <nz-option [nzValue]="null" nzLabel="Mọi người"></nz-option>
          @for (p of recipients; track p.userName) {
          <nz-option [nzValue]="p.userName" [nzLabel]="p.fullName"></nz-option>
          }
        </nz-select>
        }
        <div class="input-row">
          <textarea nz-input rows="2" maxlength="2000" placeholder="Nhập tin nhắn, Enter để gửi" [(ngModel)]="text"
            (keydown.enter)="onEnter($event)" aria-label="Nội dung tin nhắn"></textarea>
          <button nz-button nzType="primary" [nzLoading]="sending" [disabled]="!text.trim()" (click)="send()" aria-label="Gửi">
            <nz-icon nzType="send" />
          </button>
        </div>
      </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .chat { display: flex; flex-direction: column; height: 100%; }
    .messages { flex: 1; overflow-y: auto; padding: 4px 2px 8px; }
    .empty { margin-top: 40px; }
    .msg { margin: 6px 0; max-width: 88%; }
    .msg.mine { margin-left: auto; text-align: right; }
    .msg-meta { font-size: 12px; color: #8c8c8c; display: flex; gap: 6px; align-items: center; }
    .msg.mine .msg-meta { justify-content: flex-end; }
    .msg-meta b { color: #262626; }
    .private { margin: 0; font-size: 11px; line-height: 16px; }
    .msg-text { display: inline-block; text-align: left; padding: 6px 10px; border-radius: 10px; background: #f0f2f5;
      white-space: pre-wrap; word-break: break-word; margin-top: 2px; }
    .msg.mine .msg-text { background: #1677ff; color: #fff; }
    .composer { border-top: 1px solid #f0f0f0; padding-top: 8px; display: flex; flex-direction: column; gap: 6px; }
    .to { width: 100%; }
    .input-row { display: flex; gap: 6px; align-items: flex-end; }
    .input-row textarea { resize: none; }
    .disabled-note { color: #8c8c8c; padding: 10px; text-align: center; border-top: 1px solid #f0f0f0; }
  `],
})
export class RoomChatPanel implements OnInit, OnChanges, AfterViewChecked, OnDestroy {
  @Input({ required: true }) meetingId = '';
  @Input() userName = '';
  @Input() isGuest = false;
  @Input() isModerator = false;
  @Input() chatEnabled = true;
  /** Tab Chat đang mở → không tính chưa đọc. */
  @Input() active = false;
  /** Người nhận chọn sẵn (bấm "Nhắn riêng" ở panel Người tham gia). */
  @Input() recipient: RoomParticipant | null = null;
  @Output() unread = new EventEmitter<number>();
  @ViewChild('list') listRef?: ElementRef<HTMLElement>;

  private destroy$ = new Subject<void>();
  private scrollPending = false;
  private unreadCount = 0;

  messages: ChatMessage[] = [];
  recipients: RoomParticipant[] = [];
  text = '';
  to: string | null = null;
  sending = false;

  constructor(private room: RoomService, private hub: RealtimeHubService) { }

  ngOnInit(): void {
    this.room.messages(this.meetingId).pipe(takeUntil(this.destroy$)).subscribe(list => {
      this.messages = list ?? [];
      this.scrollPending = true;
    });
    this.loadRecipients();
    this.hub.roomEvent
      .pipe(filter(e => e.payload?.meetingId === this.meetingId), takeUntil(this.destroy$))
      .subscribe(e => {
        if (e.name === 'ReceiveMessage') this.receive(e.payload as ChatMessage);
        if (e.name === 'ParticipantsChanged') this.loadRecipients();
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['recipient'] && this.recipient) {
      this.to = this.recipient.userName;
      if (!this.recipients.some(r => r.userName === this.recipient!.userName)) this.recipients = [...this.recipients, this.recipient];
    }
    if (changes['active'] && this.active) {
      this.unreadCount = 0;
      this.unread.emit(0);
      this.scrollPending = true;
    }
  }

  ngAfterViewChecked(): void {
    if (this.scrollPending && this.listRef) {
      this.scrollPending = false;
      const el = this.listRef.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadRecipients(): void {
    if (this.isGuest) return;
    this.room.participants(this.meetingId).pipe(takeUntil(this.destroy$)).subscribe(list => {
      this.recipients = (list ?? []).filter(p => !p.isGuest && p.userName !== this.userName);
    });
  }

  private receive(m: ChatMessage): void {
    if (this.messages.some(x => x.id === m.id)) return;
    this.messages = [...this.messages, m];
    this.scrollPending = true;
    if (!this.active && !this.isMine(m)) {
      this.unreadCount++;
      this.unread.emit(this.unreadCount);
    }
  }

  isMine(m: ChatMessage): boolean {
    return m.senderUserId?.toLowerCase() === this.userName.toLowerCase();
  }

  nameOf(userName: string): string {
    return this.recipients.find(r => r.userName.toLowerCase() === userName.toLowerCase())?.fullName ?? userName;
  }

  time(v: string): Date | null {
    return DateTimeUtils.fromUtc(v);
  }

  onEnter(event: Event): void {
    const e = event as KeyboardEvent;
    if (e.shiftKey || e.isComposing) return;
    e.preventDefault();
    this.send();
  }

  send(): void {
    const text = this.text.trim();
    if (!text || this.sending) return;
    this.sending = true;
    this.room.send(this.meetingId, text, this.isGuest ? null : this.to)
      .pipe(finalize(() => this.sending = false), takeUntil(this.destroy$))
      .subscribe(m => {
        this.text = '';
        if (m) this.receive(m);
      });
  }
}

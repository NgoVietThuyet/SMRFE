import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { Subject, debounceTime, filter, takeUntil } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { SharedModules } from '../../../../../shared/ng-zorro.module';
import { RealtimeHubService } from '../../../../../shared/services';
import { DateTimeUtils } from '../../../../../shared/utils';
import { LobbyRequest, RoomParticipant } from '../../../models/room.models';
import { RoomService } from '../../../services/room.service';
import { MEETING_ASSIGNABLE_ROLES, roleMeta } from '../../../utils/meeting-ui';

/** Panel "Người tham gia": ai đang trong phòng / chưa vào, phòng chờ và menu thao tác của chủ trì. */
@Component({
  selector: 'app-room-people-panel',
  standalone: true,
  imports: [SharedModules],
  template: `
    @if (isModerator && lobby.length) {
    <div class="lobby">
      <div class="section-head">
        <span><nz-icon nzType="clock-circle" /> Phòng chờ ({{ lobby.length }})</span>
        <button nz-button nzType="link" nzSize="small" (click)="admitAll()">Cho vào tất cả</button>
      </div>
      @for (r of lobby; track r.id) {
      <div class="person">
        <nz-avatar nzSize="small" [nzText]="initial(r.displayName)" class="avatar"></nz-avatar>
        <div class="person-main">
          <div class="person-name">{{ r.displayName }} @if (r.isGuest) {<nz-tag>Khách</nz-tag>}</div>
          <div class="muted">chờ từ {{ time(r.requestedAt) | date: 'HH:mm' }}</div>
        </div>
        <button nz-button nzType="primary" nzSize="small" (click)="admit(r)">Cho vào</button>
        <button nz-button nzSize="small" nzDanger (click)="reject(r)" aria-label="Từ chối"><nz-icon nzType="close" /></button>
      </div>
      }
    </div>
    }

    <div class="section-head"><span>Trong phòng ({{ online.length }})</span></div>
    @for (p of online; track p.userName) {
    <ng-container *ngTemplateOutlet="row; context: { $implicit: p }"></ng-container>
    }
    @if (offline.length) {
    <div class="section-head"><span>Chưa vào ({{ offline.length }})</span></div>
    @for (p of offline; track p.userName) {
    <ng-container *ngTemplateOutlet="row; context: { $implicit: p }"></ng-container>
    }
    }

    <ng-template #row let-p>
      <div class="person" [class.dim]="!p.isOnline">
        <nz-badge [nzDot]="p.isOnline" nzColor="#52c41a" [nzOffset]="[-4, 24]">
          <nz-avatar nzSize="small" [nzText]="initial(p.fullName)" class="avatar"></nz-avatar>
        </nz-badge>
        <div class="person-main">
          <div class="person-name">{{ p.fullName }} @if (p.userName === userName) {<span class="muted">(Bạn)</span>}</div>
          <div><nz-tag [nzColor]="p.isGuest ? 'default' : roleMeta(p.role).color">{{ p.isGuest ? 'Khách' : roleMeta(p.role).label }}</nz-tag></div>
        </div>
        @if (p.userName !== userName && (isModerator || (!isGuest && !p.isGuest))) {
        <button nz-button nzType="text" nzSize="small" nz-dropdown [nzDropdownMenu]="menu" nzTrigger="click"
          nzPlacement="bottomRight" aria-label="Thao tác"><nz-icon nzType="more" /></button>
        <nz-dropdown-menu #menu="nzDropdownMenu">
          <ul nz-menu>
            @if (!isGuest && !p.isGuest) {
            <li nz-menu-item (click)="privateChat.emit(p)"><nz-icon nzType="message" />&nbsp; Nhắn riêng</li>
            }
            @if (isModerator && p.isOnline) {
            <li nz-menu-item (click)="mute(p)"><nz-icon nzType="audio-muted" />&nbsp; Tắt mic</li>
            }
            @if (isModerator && !p.isGuest && p.role !== 1) {
            <li nz-submenu nzTitle="Đổi vai trò" nzIcon="idcard">
              <ul>
                @for (r of roleOptions; track r.value) {
                <li nz-menu-item [nzDisabled]="r.value === p.role" (click)="changeRole(p, r.value)">{{ r.label }}</li>
                }
              </ul>
            </li>
            }
            @if (isModerator && p.role !== 1) {
            <li nz-menu-divider></li>
            <li nz-menu-item nzDanger nz-popconfirm [nzPopconfirmTitle]="'Mời ' + p.fullName + ' ra khỏi phòng?'"
              (nzOnConfirm)="kick(p)"><nz-icon nzType="user-delete" />&nbsp; Mời ra khỏi phòng</li>
            }
          </ul>
        </nz-dropdown-menu>
        }
      </div>
    </ng-template>
  `,
  styles: [`
    :host { display: block; }
    .section-head { display: flex; justify-content: space-between; align-items: center; padding: 10px 4px 4px;
      font-size: 12px; font-weight: 600; color: #8c8c8c; text-transform: uppercase; }
    .lobby { background: #fffbe6; border: 1px solid #ffe58f; border-radius: 6px; padding: 0 8px 6px; margin-bottom: 4px; }
    .person { display: flex; align-items: center; gap: 8px; padding: 6px 4px; border-radius: 6px; }
    .person:hover { background: #fafafa; }
    .person.dim { opacity: 0.6; }
    .person-main { flex: 1; min-width: 0; }
    .person-name { font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .avatar { background: #1677ff; flex-shrink: 0; }
    .muted { color: #8c8c8c; font-size: 12px; }
  `],
})
export class RoomPeoplePanel implements OnInit, OnChanges, OnDestroy {
  @Input({ required: true }) meetingId = '';
  @Input() userName = '';
  @Input() isModerator = false;
  @Input() isGuest = false;
  @Output() privateChat = new EventEmitter<RoomParticipant>();
  @Output() counts = new EventEmitter<{ online: number; lobby: number }>();

  private destroy$ = new Subject<void>();
  private reload$ = new Subject<void>();
  readonly roleOptions = MEETING_ASSIGNABLE_ROLES;
  readonly roleMeta = roleMeta;

  participants: RoomParticipant[] = [];
  lobby: LobbyRequest[] = [];

  constructor(private room: RoomService, private hub: RealtimeHubService, private message: NzMessageService) { }

  ngOnInit(): void {
    this.reload$.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe(() => this.load());
    this.hub.roomEvent
      .pipe(filter(e => e.payload?.meetingId === this.meetingId
        && ['PresenceChanged', 'ParticipantsChanged', 'LobbyChanged'].includes(e.name)), takeUntil(this.destroy$))
      .subscribe(() => this.reload$.next());
    this.load();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isModerator'] && !changes['isModerator'].firstChange) this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get online(): RoomParticipant[] {
    return this.participants.filter(p => p.isOnline);
  }

  get offline(): RoomParticipant[] {
    return this.participants.filter(p => !p.isOnline);
  }

  load(): void {
    this.room.participants(this.meetingId).pipe(takeUntil(this.destroy$)).subscribe(list => {
      this.participants = list ?? [];
      this.emitCounts();
    });
    if (this.isModerator) {
      this.room.lobby(this.meetingId).pipe(takeUntil(this.destroy$)).subscribe(list => {
        this.lobby = list ?? [];
        this.emitCounts();
      });
    } else {
      this.lobby = [];
    }
  }

  private emitCounts(): void {
    this.counts.emit({ online: this.online.length, lobby: this.lobby.length });
  }

  initial(name: string): string {
    const parts = (name || '?').trim().split(/\s+/);
    return parts[parts.length - 1].charAt(0).toUpperCase();
  }

  time(v: string): Date | null {
    return DateTimeUtils.fromUtc(v);
  }

  admit(r: LobbyRequest): void {
    this.room.admit(this.meetingId, r.id).subscribe(() => this.reload$.next());
  }

  reject(r: LobbyRequest): void {
    this.room.reject(this.meetingId, r.id).subscribe(() => this.reload$.next());
  }

  admitAll(): void {
    this.room.admitAll(this.meetingId).subscribe(() => this.reload$.next());
  }

  mute(p: RoomParticipant): void {
    this.room.mute(this.meetingId, p.userName).subscribe(() => this.message.success(`Đã yêu cầu tắt mic của ${p.fullName}`));
  }

  kick(p: RoomParticipant): void {
    this.room.kick(this.meetingId, p.userName).subscribe(() => this.reload$.next());
  }

  changeRole(p: RoomParticipant, role: number): void {
    this.room.changeRole(this.meetingId, p.userName, role).subscribe(() => this.reload$.next());
  }
}

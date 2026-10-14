import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, of, switchMap } from 'rxjs';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { SessionService, TokenService } from '../../../../core';
import { DateTimeUtils } from '../../../../shared/utils';
import { DashboardService } from '../../../dashboard/services/dashboard.service';
import { PublicMeeting } from '../../models/room.models';
import { RoomService } from '../../services/room.service';

const REASONS: Record<string, string> = {
  NOT_FOUND: 'Không tìm thấy cuộc họp với mã này.',
  CANCELLED: 'Cuộc họp đã bị hủy.',
  ENDED: 'Cuộc họp đã kết thúc.',
  GUEST_NOT_ALLOWED: 'Cuộc họp không mở cho khách. Hãy đăng nhập bằng tài khoản được mời.',
  NOT_INVITED: 'Cuộc họp chỉ dành cho người được mời.',
};

/**
 * `/join/:roomCode` (P10, ngoài Shell, không cần đăng nhập).
 * Đã đăng nhập → tra mã (Meeting/by-code) rồi vào phòng như thành viên.
 * Chưa đăng nhập → cuộc họp Công khai + cho phép khách: nhập tên → Auth/GuestSession → phòng họp với token khách.
 */
@Component({
  selector: 'app-guest-join',
  standalone: true,
  imports: [SharedModules],
  template: `
    <div class="page">
      <div class="card">
        <div class="brand"><img src="img/d2s_logo.png" alt="" /> SMART MEETING</div>
        @if (loading) {
        <nz-spin nzSimple class="spin"></nz-spin>
        } @else if (reason) {
        <nz-result nzStatus="warning" [nzTitle]="reason" [nzSubTitle]="'Mã phòng: ' + roomCode">
          <div nz-result-extra>
            <button nz-button nzType="primary" (click)="login()">Đăng nhập</button>
          </div>
        </nz-result>
        } @else if (info) {
        <h2>{{ info.name }}</h2>
        @if (start) { <div class="meta"><nz-icon nzType="clock-circle" /> {{ start | date: 'HH:mm, dd/MM/yyyy' }}</div> }
        <div class="meta"><nz-icon nzType="user" /> Chủ trì: {{ info.hostName || '---' }}</div>
        <label class="text-control" for="guest-name">Tên hiển thị của bạn <span class="required-star">*</span></label>
        <input id="guest-name" nz-input nzSize="large" maxlength="100" [(ngModel)]="name" (keydown.enter)="joinAsGuest()"
          placeholder="VD: Nguyễn Văn A — Công ty ABC" autocomplete="name" />
        @if (error) { <div class="field-error">{{ error }}</div> }
        <button nz-button nzType="primary" nzSize="large" nzBlock class="go" [nzLoading]="busy" (click)="joinAsGuest()">
          Tham gia với tư cách khách
        </button>
        <div class="alt">Có tài khoản? <a (click)="login()">Đăng nhập</a> để vào với tên của bạn.</div>
        }
      </div>
    </div>
  `,
  styles: [`
    .page { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px;
      background: linear-gradient(135deg, #e6f4ff 0%, #f5f7fa 60%); }
    .card { width: 100%; max-width: 440px; background: #fff; border-radius: 16px; padding: 28px;
      box-shadow: 0 10px 40px rgba(22, 119, 255, 0.08); }
    .brand { display: flex; align-items: center; gap: 8px; font-size: 12px; letter-spacing: 2px; color: #1677ff; font-weight: 600; margin-bottom: 12px; }
    .brand img { height: 24px; }
    .spin { display: block; margin: 40px auto; }
    h2 { margin: 0 0 10px; }
    .meta { color: #595959; margin-bottom: 6px; display: flex; gap: 6px; align-items: center; }
    .text-control { margin-top: 16px; display: block; }
    .go { margin-top: 16px; }
    .alt { margin-top: 12px; text-align: center; color: #8c8c8c; }
  `],
})
export class GuestJoin implements OnInit {
  roomCode = '';
  loading = true;
  busy = false;
  info: PublicMeeting | null = null;
  reason = '';
  name = '';
  error = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private tokens: TokenService,
    private session: SessionService,
    private room: RoomService,
    private dashboard: DashboardService,
  ) { }

  get start(): Date | null {
    return DateTimeUtils.fromUtc(this.info?.expectedStartTime);
  }

  ngOnInit(): void {
    this.roomCode = (this.route.snapshot.paramMap.get('roomCode') ?? '').trim();
    // Đã đăng nhập (có refresh token) → đi luồng thành viên.
    const loggedIn$ = this.tokens.isGuest ? of(false) : this.tokens.ensureSession().pipe(
      switchMap(ok => ok ? (this.session.accountInfo ? of(true) : this.session.load()) : of(false)),
    );
    loggedIn$.subscribe(loggedIn => loggedIn ? this.asMember() : this.asGuest());
  }

  private asMember(): void {
    this.dashboard.lookupByCode(this.roomCode).pipe(finalize(() => this.loading = false)).subscribe({
      next: res => {
        if (res?.canJoin && res.meetingId) {
          this.router.navigate(['/meetings', res.meetingId, 'join'], { replaceUrl: true });
        } else {
          this.reason = REASONS[res?.reason ?? 'NOT_FOUND'] ?? REASONS['NOT_FOUND'];
        }
      },
      error: () => this.reason = REASONS['NOT_FOUND'],
    });
  }

  private asGuest(): void {
    this.room.publicInfo(this.roomCode).pipe(finalize(() => this.loading = false)).subscribe({
      next: info => {
        if (info?.guestAllowed && info.meetingId) {
          this.info = info;
          // Đã là khách của cuộc họp này trong tab (F5) → vào thẳng.
          if (this.tokens.restoreGuest(info.meetingId)) {
            this.router.navigate(['/meetings', info.meetingId, 'join'], { replaceUrl: true });
          }
        } else {
          this.reason = REASONS[info?.reason ?? 'NOT_FOUND'] ?? REASONS['NOT_FOUND'];
        }
      },
      error: () => this.reason = REASONS['NOT_FOUND'],
    });
  }

  joinAsGuest(): void {
    const name = this.name.trim();
    if (!name) {
      this.error = 'Vui lòng nhập tên hiển thị';
      return;
    }
    if (!this.info?.meetingId || this.busy) return;
    this.error = '';
    this.busy = true;
    const meetingId = this.info.meetingId;
    this.room.guestSession(meetingId, name).pipe(finalize(() => this.busy = false)).subscribe(res => {
      if (res?.data?.token) {
        this.tokens.setGuestToken(res.data.token, meetingId);
        this.router.navigate(['/meetings', meetingId, 'join'], { replaceUrl: true });
      }
    });
  }

  login(): void {
    this.router.navigate(['/login'], { queryParams: { returnUrl: `/join/${this.roomCode}` } });
  }
}

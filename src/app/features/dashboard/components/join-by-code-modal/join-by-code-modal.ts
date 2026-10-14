import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, finalize, takeUntil } from 'rxjs';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { DateTimeUtils } from '../../../../shared/utils';
import { DashboardService } from '../../services/dashboard.service';
import { MeetingCodeLookup } from '../../models/dashboard.models';

const REASON_TEXT: Record<string, string> = {
  NOT_FOUND: 'Không tìm thấy cuộc họp với mã này',
  NOT_INVITED: 'Cuộc họp chỉ dành cho người được mời',
  CANCELLED: 'Cuộc họp đã bị hủy',
  ENDED: 'Cuộc họp đã kết thúc',
};

/**
 * Modal "Tham gia bằng mã" (Plan P8 §4.7): GET /api/Meeting/by-code/{roomCode}.
 * Chấp nhận dán cả link …/join/{mã}. Cuộc họp đang diễn ra → vào ngay; chưa bắt đầu → hiện thông tin + nút vào phòng chờ.
 */
@Component({
  selector: 'app-join-by-code-modal',
  standalone: true,
  imports: [SharedModules],
  template: `
    <nz-modal [nzVisible]="visible" nzTitle="THAM GIA BẰNG MÃ" [nzFooter]="footer" (nzOnCancel)="close()">
      <ng-container *nzModalContent>
        <label class="text-control" for="room-code">Mã phòng hoặc link mời</label>
        <input id="room-code" nz-input nzSize="large" class="code-input" autocomplete="off" placeholder="VD: ABC12345"
          [(ngModel)]="code" (ngModelChange)="onCodeChange()" (keydown.enter)="lookup()" />
        @if (error) {
        <div class="field-error">
          {{ error }}
          @if (result?.reason === 'ENDED' && result?.meetingId) {
          · <a (click)="openDetail()">Xem chi tiết</a>
          }
        </div>
        }

        @if (result?.canJoin && result?.status === 1) {
        <div class="preview">
          <div class="preview-name">{{ result!.name }}</div>
          <div class="preview-meta">
            <nz-icon nzType="clock-circle" />
            {{ start | date: 'HH:mm dd/MM/yyyy' }} · Chủ trì: {{ result!.hostName }}
          </div>
          <div class="preview-meta">Cuộc họp chưa bắt đầu. Bạn có thể vào phòng chờ trước.</div>
        </div>
        }
      </ng-container>
      <ng-template #footer>
        <button nz-button (click)="close()">Huỷ</button>
        @if (result?.canJoin && result?.status === 1) {
        <button nz-button nzType="primary" (click)="emitJoin()"><nz-icon nzType="login" /> Vào phòng chờ</button>
        } @else {
        <button nz-button nzType="primary" [nzLoading]="isLoading" (click)="lookup()">Tham gia</button>
        }
      </ng-template>
    </nz-modal>
  `,
  styles: [`
    .code-input { text-transform: uppercase; letter-spacing: 2px; font-weight: 600; }
    .preview { margin-top: 12px; padding: 10px 12px; background: #f5f7fa; border-radius: 6px; }
    .preview-name { font-weight: 600; margin-bottom: 4px; }
    .preview-meta { color: #8c8c8c; font-size: 12px; display: flex; align-items: center; gap: 4px; }
  `],
})
export class JoinByCodeModal implements OnChanges, OnDestroy {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  /** Phát meetingId khi được phép vào. */
  @Output() join = new EventEmitter<string>();

  private destroy$ = new Subject<void>();
  code = '';
  error = '';
  result: MeetingCodeLookup | null = null;
  isLoading = false;

  constructor(private service: DashboardService, private router: Router) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue) {
      this.code = '';
      this.error = '';
      this.result = null;
    }
  }

  get start(): Date | null {
    return DateTimeUtils.fromUtc(this.result?.expectedStartTime);
  }

  onCodeChange(): void {
    this.error = '';
    this.result = null;
  }

  /** Lấy mã từ chuỗi người dùng nhập: bỏ khoảng trắng; nếu là link thì lấy phần sau /join/. */
  static extractCode(raw: string): string {
    const value = (raw ?? '').trim();
    const match = value.match(/\/join\/([^/?#\s]+)/i);
    const code = match ? decodeURIComponent(match[1]) : value;
    return code.replace(/\s+/g, '').toUpperCase();
  }

  lookup(): void {
    const code = JoinByCodeModal.extractCode(this.code);
    if (!code) {
      this.error = 'Vui lòng nhập mã phòng họp';
      return;
    }
    this.isLoading = true;
    this.service.lookupByCode(code)
      .pipe(finalize(() => this.isLoading = false), takeUntil(this.destroy$))
      .subscribe(res => {
        this.result = res;
        if (!res?.canJoin) {
          this.error = REASON_TEXT[res?.reason ?? 'NOT_FOUND'] ?? REASON_TEXT['NOT_FOUND'];
          return;
        }
        // Đang diễn ra → vào luôn; chưa bắt đầu → hiện thông tin để người dùng xác nhận.
        if (res.status === 2) {
          this.emitJoin();
        }
      });
  }

  emitJoin(): void {
    if (this.result?.meetingId) {
      this.join.emit(this.result.meetingId);
    }
  }

  openDetail(): void {
    if (this.result?.meetingId) {
      this.visibleChange.emit(false);
      this.router.navigate(['/meetings', this.result.meetingId]);
    }
  }

  close(): void {
    this.visibleChange.emit(false);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

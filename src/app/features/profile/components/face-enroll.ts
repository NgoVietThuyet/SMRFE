import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, finalize, takeUntil } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { SharedModules } from '../../../shared/ng-zorro.module';
import { FaceStatus } from '../../../shared/services/auth.service';
import { AuthService } from '../../../shared/services';
import { FaceCapture } from '../../../shared/components/face-capture/face-capture';

/** Tab "Khuôn mặt" trong Hồ sơ: đăng ký / xóa khuôn mặt dùng để đăng nhập và vào họp nhanh. */
@Component({
  selector: 'app-face-enroll',
  standalone: true,
  imports: [SharedModules, FaceCapture],
  template: `
    <div class="face-tab">
      @if (!status) {
      <nz-spin nzSimple></nz-spin>
      } @else if (!status.enabled) {
      <nz-alert nzType="info" nzShowIcon nzMessage="Đăng nhập bằng khuôn mặt chưa được bật trên hệ thống này."></nz-alert>
      } @else if (!status.allowed) {
      <nz-alert nzType="warning" nzShowIcon nzMessage="Tài khoản quản trị không dùng đăng nhập bằng khuôn mặt. Hãy dùng mật khẩu."></nz-alert>
      } @else {
      <div class="state">
        <nz-tag [nzColor]="status.enrolled ? 'success' : 'default'">{{ status.enrolled ? 'Đã đăng ký khuôn mặt' : 'Chưa đăng ký khuôn mặt' }}</nz-tag>
        @if (status.enrolled) { <span class="muted">{{ status.samples }} mẫu</span> }
      </div>
      <p class="desc">
        Sau khi đăng ký, bạn đăng nhập bằng cách nhập tên đăng nhập rồi quét mặt, và vào họp qua link chỉ cần quét mặt.
        Hệ thống chỉ lưu đặc trưng khuôn mặt đã mã hóa, không lưu ảnh. Bạn có thể xóa bất cứ lúc nào; mật khẩu vẫn dùng bình thường.
      </p>
      <div class="actions">
        <button nz-button nzType="primary" (click)="open()">
          <nz-icon nzType="scan" /> {{ status.enrolled ? 'Đăng ký lại khuôn mặt' : 'Đăng ký khuôn mặt' }}
        </button>
        @if (status.enrolled) {
        <button nz-button nzDanger nz-popconfirm nzPopconfirmTitle="Xóa dữ liệu khuôn mặt của bạn?" (nzOnConfirm)="remove()">
          <nz-icon nzType="delete" /> Xóa khuôn mặt
        </button>
        }
      </div>
      }
    </div>

    <nz-modal [(nzVisible)]="visible" nzTitle="Đăng ký khuôn mặt" (nzOnCancel)="close()" [nzFooter]="null" [nzMaskClosable]="false">
      <ng-container *nzModalContent>
        @if (!scanning) {
        <label class="lbl" for="face-pw">Nhập lại mật khẩu để xác nhận</label>
        <input id="face-pw" type="password" nz-input nzSize="large" [(ngModel)]="password" autocomplete="current-password" />
        <label nz-checkbox class="consent" [(ngModel)]="consent">
          Tôi đồng ý để hệ thống xử lý dữ liệu khuôn mặt (dữ liệu sinh trắc học) của tôi nhằm đăng nhập và vào họp.
        </label>
        @if (error) { <div class="err">{{ error }}</div> }
        <button nz-button nzType="primary" nzBlock nzSize="large" class="go" [disabled]="!password || !consent" (click)="begin()">
          Bắt đầu quét
        </button>
        } @else {
        <app-face-capture mode="enroll" (captured)="onCaptured($event)" (failed)="onFailed($event)"></app-face-capture>
        @if (busy) { <div class="muted center">Đang lưu khuôn mặt…</div> }
        }
      </ng-container>
    </nz-modal>
  `,
  styles: [`
    .state { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .muted { color: #8c8c8c; }
    .center { text-align: center; margin-top: 8px; }
    .desc { color: #595959; max-width: 640px; }
    .actions { display: flex; gap: 12px; flex-wrap: wrap; }
    .lbl { display: block; margin-bottom: 6px; }
    .consent { display: block; margin-top: 14px; }
    .err { color: #cf1322; margin-top: 10px; }
    .go { margin-top: 16px; }
  `],
})
export class FaceEnroll implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  status: FaceStatus | null = null;
  visible = false;
  scanning = false;
  busy = false;
  password = '';
  consent = false;
  error = '';

  constructor(private auth: AuthService, private message: NzMessageService) { }

  ngOnInit(): void {
    this.reload();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private reload(): void {
    this.auth.faceStatus().pipe(takeUntil(this.destroy$)).subscribe({
      next: s => this.status = s,
      error: () => this.status = { enabled: false, allowed: false, enrolled: false, samples: 0 },
    });
  }

  open(): void {
    this.password = '';
    this.consent = false;
    this.error = '';
    this.scanning = false;
    this.visible = true;
  }

  close(): void {
    this.visible = false;
    this.scanning = false;
    this.busy = false;
    this.password = '';
  }

  begin(): void {
    this.error = '';
    this.scanning = true;
  }

  onFailed(message: string): void {
    this.error = message;
    this.scanning = false;
  }

  onCaptured(frames: string[]): void {
    if (this.busy) return;
    this.busy = true;
    this.auth.faceEnroll({ password: this.password, consent: this.consent, frames })
      .pipe(finalize(() => this.busy = false), takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.close();
          this.reload();
        },
        // CommonService đã báo lỗi; quay lại bước nhập để thử lại (ví dụ sai mật khẩu, ảnh không đạt).
        error: () => {
          this.scanning = false;
          this.error = 'Đăng ký chưa thành công. Kiểm tra mật khẩu và quét lại.';
        },
      });
  }

  remove(): void {
    this.auth.faceRemove().pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.message.success('Đã xóa dữ liệu khuôn mặt.');
      this.reload();
    });
  }
}

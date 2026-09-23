import { Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { AuthService } from '../../core/services/auth.service';

// =====================================================
// Login — SmartMeeting
// Màn hình xác thực nội bộ: email + password hoặc Google.
// - Không Sidebar / Global Header (route đứng ngoài Shell).
// - Chỉ chấp nhận tài khoản đã được cấp quyền, không có Đăng ký.
// - Dùng nz-input / nz-button + global style.scss, không style riêng lẻ.
// =====================================================
@Component({
    selector: 'app-login',
    templateUrl: './login.html',
    styleUrl: './login.scss',
    imports: [ReactiveFormsModule, NzButtonModule, NzIconModule, NzInputModule],
})
export class Login {
    private readonly fb = inject(FormBuilder);
    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);
    private readonly destroyRef = inject(DestroyRef);

    readonly form = this.fb.group({
        email: ['', [Validators.required, Validators.email]],
        password: ['', [Validators.required]],
    });

    // Trạng thái submit email/password
    readonly loading = signal(false);
    // Thông báo chung 1.15 — không tiết lộ email có tồn tại hay không
    readonly authError = signal<string | null>(null);

    // Lỗi Google — BE chưa có OAuth nên chỉ báo chưa kết nối
    readonly googleError = signal<string | null>(null);
    readonly supportMessage = signal<string | null>(null);
    readonly forgotLoading = signal(false);

    // Đồng bộ 2 chiều với toggle eye built-in của nz-input-password
    readonly showPassword = signal(false);

    get emailCtrl() {
        return this.form.get('email')!;
    }

    get passwordCtrl() {
        return this.form.get('password')!;
    }

    onSubmit(): void {
        this.authError.set(null);
        this.googleError.set(null);
        this.supportMessage.set(null);
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        this.loading.set(true);
        this.form.disable();

        this.auth
            .login(this.emailCtrl.value ?? '', this.passwordCtrl.value ?? '')
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => void this.router.navigate(['/']),
                error: (err: unknown) => {
                    this.loading.set(false);
                    this.form.enable();
                    if (err instanceof HttpErrorResponse && err.status === 0) {
                        this.authError.set('Không thể kết nối máy chủ. Vui lòng kiểm tra kết nối và thử lại.');
                    } else if (err instanceof HttpErrorResponse && err.status >= 500) {
                        this.authError.set('Hệ thống đang tạm gián đoạn. Vui lòng thử lại sau.');
                    } else {
                        this.authError.set('Email hoặc mật khẩu không chính xác.');
                    }
                },
            });
    }

    onGoogleLogin(): void {
        this.authError.set(null);
        this.supportMessage.set(null);
        // BE chưa có endpoint Google OAuth nên giữ nút theo spec
        // nhưng báo rõ chưa kết nối thay vì giả vờ xác thực.
        // TODO: đấu Google OAuth (FE) + endpoint kiểm tra quyền (BE) để dùng message 1.16.
        this.googleError.set(
            'Đăng nhập bằng Google chưa được kết nối. Vui lòng dùng email và mật khẩu.'
        );
    }

    onForgotPassword(): void {
        this.authError.set(null);
        this.googleError.set(null);
        this.supportMessage.set(null);
        this.emailCtrl.markAsTouched();
        if (this.emailCtrl.invalid) return;

        this.forgotLoading.set(true);
        this.auth
            .forgotPassword(this.emailCtrl.value ?? '')
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.forgotLoading.set(false);
                    this.supportMessage.set('Nếu email hợp lệ, hướng dẫn đặt lại mật khẩu đã được gửi.');
                },
                error: (err: unknown) => {
                    this.forgotLoading.set(false);
                    if (err instanceof HttpErrorResponse && err.status === 0) {
                        this.authError.set('Không thể kết nối máy chủ. Vui lòng thử lại.');
                    } else {
                        this.supportMessage.set('Nếu email hợp lệ, hướng dẫn đặt lại mật khẩu đã được gửi.');
                    }
                },
            });
    }
}

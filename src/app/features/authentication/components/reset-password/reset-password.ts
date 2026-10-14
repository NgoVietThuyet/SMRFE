import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { AuthService } from '../../../../shared/services';

/** Đặt lại mật khẩu bằng mã nhận qua email (POST /api/Auth/ResetPassword). Link email có dạng /reset-password?token=... */
@Component({
    selector: 'app-reset-password',
    standalone: true,
    imports: [SharedModules],
    templateUrl: './reset-password.html',
    styleUrl: './reset-password.scss'
})
export class ResetPassword implements OnInit {
    resetToken = '';
    newPassword = '';
    confirmPassword = '';
    isSubmitting = false;
    isPasswordVisible = false;

    constructor(
        private readonly authService: AuthService,
        private readonly route: ActivatedRoute,
        private readonly router: Router,
        private readonly message: NzMessageService,
    ) { }

    ngOnInit(): void {
        this.resetToken = this.route.snapshot.queryParamMap.get('token') ?? '';
    }

    submit(): void {
        if (!this.resetToken.trim()) {
            this.message.warning('Vui lòng nhập mã đặt lại mật khẩu');
            return;
        }
        if (this.newPassword.length < 8) {
            this.message.warning('Mật khẩu mới phải có ít nhất 8 ký tự');
            return;
        }
        if (this.newPassword !== this.confirmPassword) {
            this.message.warning('Mật khẩu xác nhận không khớp');
            return;
        }

        this.isSubmitting = true;
        this.authService.resetPassword({ resetToken: this.resetToken.trim(), newPassword: this.newPassword })
            .pipe(finalize(() => this.isSubmitting = false))
            .subscribe(() => this.router.navigate(['/login']));
    }

    backToLogin(): void {
        this.router.navigate(['/login']);
    }
}

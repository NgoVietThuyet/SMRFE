import { Injectable } from '@angular/core';
import { CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { catchError, switchMap } from 'rxjs/operators';
import { TokenService } from '../services/token.service';
import { SessionService } from '../services/session.service';

/**
 * Cho vào khi có phiên hợp lệ; nếu mất access token (F5) thì dùng refresh token để khôi phục.
 * Khi hệ thống bật khuôn mặt: tài khoản được phép dùng nhưng CHƯA có khuôn mặt thì không giữ phiên cũ (refresh token đã lưu):
 * đăng xuất, về trang đăng nhập để đăng nhập lại và đăng ký khuôn mặt. Kiểm tra một lần mỗi phiên trình duyệt.
 */
@Injectable({
    providedIn: 'root'
})
export class AuthGuard implements CanActivate {
    constructor(
        private router: Router,
        private tokenService: TokenService,
        private session: SessionService,
    ) { }

    canActivate(_route: unknown, state: RouterStateSnapshot): Observable<boolean> | boolean {
        if (this.tokenService.hasValidAccessToken() && this.session.accountInfo) {
            return this.faceGate(state);
        }

        return this.tokenService.ensureSession().pipe(
            switchMap((ok) => (ok ? this.session.load() : of(false))),
            switchMap((ok) => {
                if (ok) {
                    return this.faceGate(state);
                }
                this.session.clear();
                this.tokenService.clear();
                this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
                return of(false);
            }),
        );
    }

    /** true = cho vào. Chưa có khuôn mặt (và được phép dùng) → đăng xuất rồi về /login?faceRequired=1. */
    private faceGate(state: RouterStateSnapshot): Observable<boolean> {
        if (this.session.isFaceGateDone()) {
            return of(true);
        }
        return this.session.faceStatus().pipe(
            switchMap((s) => {
                if (s && s.enabled && s.allowed && !s.enrolled) {
                    return this.tokenService.logout().pipe(
                        catchError(() => of(undefined)),
                        switchMap(() => {
                            this.session.clear();
                            this.tokenService.clear();
                            this.session.resetFaceGate();
                            this.router.navigate(['/login'], { queryParams: { returnUrl: state.url, faceRequired: 1 } });
                            return of(false);
                        }),
                    );
                }
                if (s) {
                    this.session.markFaceGateDone(); // đã có khuôn mặt, hoặc tính năng tắt / tài khoản không dùng
                }
                return of(true);
            }),
        );
    }
}

export default AuthGuard;

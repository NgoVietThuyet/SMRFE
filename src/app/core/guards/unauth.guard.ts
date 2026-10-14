import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { TokenService } from '../services/token.service';

/** Trang đăng nhập/đặt lại mật khẩu: đã có phiên thì chuyển vào trong. */
@Injectable({
    providedIn: 'root'
})
export class UnauthGuard implements CanActivate {
    constructor(
        private router: Router,
        private tokenService: TokenService,
    ) { }

    canActivate(): Observable<boolean> | boolean {
        if (this.tokenService.hasValidAccessToken()) {
            this.router.navigate(['/']);
            return false;
        }

        return this.tokenService.ensureSession().pipe(
            map((ok) => {
                if (ok) {
                    this.router.navigate(['/']);
                    return false;
                }
                return true;
            }),
        );
    }
}

export default UnauthGuard;

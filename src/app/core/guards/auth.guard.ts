import { Injectable } from '@angular/core';
import { CanActivate, Router, RouterStateSnapshot } from '@angular/router';
import { Observable, of } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { TokenService } from '../services/token.service';
import { SessionService } from '../services/session.service';

/** Cho vào khi có phiên hợp lệ; nếu mất access token (F5) thì dùng refresh token để khôi phục. */
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
            return true;
        }

        return this.tokenService.ensureSession().pipe(
            switchMap((ok) => (ok ? this.session.load() : of(false))),
            switchMap((ok) => {
                if (ok) {
                    return of(true);
                }
                this.session.clear();
                this.tokenService.clear();
                this.router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
                return of(false);
            }),
        );
    }
}

export default AuthGuard;

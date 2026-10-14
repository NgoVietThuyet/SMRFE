import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { SessionService, TokenService } from '../services';

/**
 * Phòng họp `/meetings/:id/join` (P10): cho vào nếu
 *   • có token khách (Auth/GuestSession) của đúng cuộc họp này, hoặc
 *   • đăng nhập bình thường (giống AuthGuard: khôi phục phiên bằng refresh token khi F5).
 */
export const roomGuard: CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => {
    const tokens = inject(TokenService);
    const session = inject(SessionService);
    const router = inject(Router);
    const meetingId = route.paramMap.get('id') ?? '';

    if (tokens.restoreGuest(meetingId)) {
        return true;
    }
    if (tokens.hasValidAccessToken() && !tokens.isGuest && session.accountInfo) {
        return true;
    }
    return tokens.ensureSession().pipe(
        switchMap(ok => (ok ? session.load() : of(false))),
        switchMap(ok => {
            if (ok) return of(true);
            session.clear();
            tokens.clear();
            router.navigate(['/login'], { queryParams: { returnUrl: state.url } });
            return of(false);
        }),
    );
};

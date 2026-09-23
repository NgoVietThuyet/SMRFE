import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

// Không gắn Bearer cho các endpoint tự thân của Auth.
const AUTH_URLS = ['/api/Auth/Login', '/api/Auth/Refresh', '/api/Auth/ForgotPassword'];

// =====================================================
// - Gắn Authorization: Bearer <accessToken> cho mọi API.
// - Gặp 401: thử refresh 1 lần rồi retry request gốc.
//   Refresh hỏng → xóa phiên, về /login.
// - Giữ đơn giản: không xếp hàng các 401 đồng thời.
// =====================================================
export const authInterceptor: HttpInterceptorFn = (req, next) => {
    const auth = inject(AuthService);
    const isAuthUrl = AUTH_URLS.some((url) => req.url.includes(url));

    const token = auth.getAccessToken();
    const authReq = token && !isAuthUrl
        ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
        : req;

    return next(authReq).pipe(
        catchError((err: unknown) => {
            const unauthorized = err instanceof HttpErrorResponse && err.status === 401;
            if (!unauthorized || isAuthUrl || req.url.includes('/api/Auth/')) {
                return throwError(() => err);
            }
            return auth.refresh().pipe(
                switchMap((newToken) =>
                    next(req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } }))
                ),
                catchError((refreshErr: unknown) => {
                    auth.handleUnauthorized();
                    return throwError(() => refreshErr);
                })
            );
        })
    );
};

import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, Observable, tap, throwError } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
    ApiResponse,
    AuthResult,
    AuthUser,
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
} from '../models/auth.models';

const ACCESS_TOKEN_KEY = 'smr.access_token';
const REFRESH_TOKEN_KEY = 'smr.refresh_token';
const USER_KEY = 'smr.user';

// =====================================================
// AuthService — cửa ngõ duy nhất FE gọi API Auth của BE.
// - Login gửi { userName, password } (BE chấp nhận email).
// - Token lưu localStorage để giữ phiên sau reload.
// - Lỗi BE được ném nguyên message; component tự map
//   sang thông báo chung (Login không lộ email tồn tại).
// =====================================================
@Injectable({ providedIn: 'root' })
export class AuthService {
    private readonly http = inject(HttpClient);
    private readonly router = inject(Router);

    private readonly accessToken = signal<string | null>(localStorage.getItem(ACCESS_TOKEN_KEY));
    private readonly refreshTokenValue = signal<string | null>(
        localStorage.getItem(REFRESH_TOKEN_KEY)
    );
    private readonly user = signal<AuthUser | null>(this.readUser());

    readonly isAuthenticated = computed(() => this.accessToken() !== null);
    readonly currentUser = this.user.asReadonly();

    getAccessToken(): string | null {
        return this.accessToken();
    }

    login(email: string, password: string): Observable<AuthUser> {
        const body: LoginRequest = { userName: email.trim(), password };
        return this.http.post<ApiResponse<AuthResult>>(`${API_BASE_URL}/api/Auth/Login`, body).pipe(
            map((res) => {
                if (!res.status || !res.data?.success || !res.data.token) {
                    throw new Error(res.message || res.data?.message || 'Đăng nhập thất bại.');
                }
                return res.data;
            }),
            tap((result) => this.persistSession(result)),
            map((result) => this.toUser(result)),
            tap((user) => this.user.set(user))
        );
    }

    refresh(): Observable<string> {
        const refreshToken = this.refreshTokenValue();
        if (!refreshToken) return throwError(() => new Error('Missing refresh token.'));

        const body: RefreshRequest = { refreshToken };
        return this.http
            .post<ApiResponse<AuthResult>>(`${API_BASE_URL}/api/Auth/Refresh`, body)
            .pipe(
                map((res) => {
                    if (!res.status || !res.data?.success || !res.data.token) {
                        throw new Error(res.message || 'Refresh token hết hạn.');
                    }
                    return res.data;
                }),
                tap((result) => this.persistSession(result)),
                map((result) => result.token as string)
            );
    }

    logout(logoutAllDevices = false): Observable<void> {
        const body: LogoutRequest = { logoutAllDevices };
        return this.http.post<ApiResponse<null>>(`${API_BASE_URL}/api/Auth/Logout`, body).pipe(
            catchError(() => {
                // API lỗi vẫn xóa phiên local để không kẹt đăng nhập.
                return [];
            }),
            tap(() => this.clearSession()),
            map(() => undefined)
        );
    }

    forgotPassword(email: string): Observable<string> {
        const body: ForgotPasswordRequest = { email: email.trim() };
        return this.http
            .post<ApiResponse<string>>(`${API_BASE_URL}/api/Auth/ForgotPassword`, body)
            .pipe(
                map((res) => {
                    if (!res.status) throw new Error(res.message || 'Gửi yêu cầu thất bại.');
                    return res.message;
                })
            );
    }

    /** BE trả 401 không cứu được (refresh hỏng) → về /login. */
    handleUnauthorized(): void {
        this.clearSession();
        void this.router.navigate(['/login']);
    }

    private persistSession(result: AuthResult): void {
        localStorage.setItem(ACCESS_TOKEN_KEY, result.token as string);
        if (result.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, result.refreshToken);
        localStorage.setItem(USER_KEY, JSON.stringify(this.toUser(result)));
        this.accessToken.set(result.token as string);
        if (result.refreshToken) this.refreshTokenValue.set(result.refreshToken);
    }

    private clearSession(): void {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        this.accessToken.set(null);
        this.refreshTokenValue.set(null);
        this.user.set(null);
    }

    private toUser(result: AuthResult): AuthUser {
        return {
            userName: result.userName ?? '',
            fullName: result.fullName ?? result.userName ?? '',
            email: result.email ?? '',
        };
    }

    private readUser(): AuthUser | null {
        try {
            const raw = localStorage.getItem(USER_KEY);
            return raw ? (JSON.parse(raw) as AuthUser) : null;
        } catch {
            return null;
        }
    }
}

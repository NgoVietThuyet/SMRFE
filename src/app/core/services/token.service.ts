import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, finalize, map, shareReplay } from 'rxjs/operators';
import { EnvironmentService } from './environment.service';
import { JwtUtils, LocalStorageUtils } from '../../shared/utils';

/** Kết quả đăng nhập / refresh của BE-Java (AuthResultResponse). */
export interface AuthResult {
  success: boolean;
  message: string;
  token: string;
  userName: string;
  fullName: string;
  email: string;
  mustChangePassword: boolean;
  refreshToken: string;
}

const REFRESH_TOKEN_KEY = 'rt';
/** Token khách (P10) — chỉ sống trong tab hiện tại, gắn với một cuộc họp. */
const GUEST_TOKEN_KEY = 'smr.guest';

/**
 * Access token chỉ giữ trong bộ nhớ (mất khi F5 → tự lấy lại bằng refresh token).
 * BE-Java trả refresh token trong body (không dùng cookie HttpOnly), nên lưu bằng LocalStorageUtils (mã hoá AES)
 * và xoá khi đăng xuất.
 */
@Injectable({ providedIn: 'root' })
export class TokenService {
  private accessToken: string | null = null;
  private refreshInFlight: Observable<boolean> | null = null;

  constructor(
    private http: HttpClient,
    private env: EnvironmentService,
  ) { }

  setTokens(result: Pick<AuthResult, 'token' | 'refreshToken'>): void {
    this.accessToken = result.token?.trim() || null;
    if (result.refreshToken) {
      LocalStorageUtils.setItem(REFRESH_TOKEN_KEY, result.refreshToken);
    }
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }

  /** Khách vào bằng link (Auth/GuestSession): token 4 giờ, không có refresh token, chỉ dùng cho một cuộc họp. */
  setGuestToken(token: string, meetingId: string): void {
    this.accessToken = token?.trim() || null;
    try { sessionStorage.setItem(GUEST_TOKEN_KEY, JSON.stringify({ token, meetingId })); } catch { /* chế độ riêng tư */ }
  }

  /** Khôi phục token khách sau F5 (cùng tab). Trả về true nếu có token khách còn hạn cho đúng cuộc họp. */
  restoreGuest(meetingId: string): boolean {
    if (this.isGuestFor(meetingId)) return true;
    try {
      const saved = JSON.parse(sessionStorage.getItem(GUEST_TOKEN_KEY) || 'null');
      if (saved?.meetingId === meetingId && JwtUtils.isUsable(saved.token)) {
        this.accessToken = saved.token;
        return true;
      }
    } catch { /* bỏ qua */ }
    return false;
  }

  /** Access token hiện tại là token khách của cuộc họp này? */
  isGuestFor(meetingId: string): boolean {
    const payload = JwtUtils.parsePayload(this.accessToken);
    return JwtUtils.isUsable(this.accessToken) && String(payload?.['IsGuest']).toLowerCase() === 'true' && payload?.['MeetingId'] === meetingId;
  }

  get isGuest(): boolean {
    const payload = JwtUtils.parsePayload(this.accessToken);
    return String(payload?.['IsGuest']).toLowerCase() === 'true';
  }

  clearGuest(): void {
    if (this.isGuest) this.accessToken = null;
    try { sessionStorage.removeItem(GUEST_TOKEN_KEY); } catch { /* bỏ qua */ }
  }

  hasValidAccessToken(): boolean {
    return JwtUtils.isUsable(this.accessToken);
  }

  clear(): void {
    this.accessToken = null;
    this.refreshInFlight = null;
    LocalStorageUtils.removeItem(REFRESH_TOKEN_KEY);
  }

  /** Khôi phục phiên (sau F5 hoặc khi access token hết hạn) bằng refresh token. */
  refreshSession(): Observable<boolean> {
    if (this.hasValidAccessToken()) {
      return of(true);
    }

    const refreshToken: string | null = LocalStorageUtils.getItem(REFRESH_TOKEN_KEY);
    if (!JwtUtils.isUsable(refreshToken)) {
      this.clear();
      return of(false);
    }

    if (!this.refreshInFlight) {
      const url = `${this.env.getEnv('baseUrl')}/Auth/Refresh`;
      this.refreshInFlight = this.http.post<any>(url, { refreshToken }, { headers: this.bypassAuth() }).pipe(
        map((res) => {
          const data: AuthResult | undefined = res?.data;
          if (res?.status && JwtUtils.isUsable(data?.token)) {
            this.setTokens(data!);
            return true;
          }
          this.clear();
          return false;
        }),
        catchError(() => {
          this.clear();
          return of(false);
        }),
        finalize(() => {
          this.refreshInFlight = null;
        }),
        shareReplay(1),
      );
    }

    return this.refreshInFlight;
  }

  ensureSession(): Observable<boolean> {
    return this.refreshSession();
  }

  /** BE thu hồi phiên bằng TokenVersion; lỗi mạng vẫn coi như đã đăng xuất ở client. */
  logout(logoutAllDevices = false): Observable<void> {
    const url = `${this.env.getEnv('baseUrl')}/Auth/Logout`;
    if (!this.hasValidAccessToken()) {
      return of(undefined);
    }
    return this.http.post(url, { logoutAllDevices }).pipe(
      map(() => undefined),
      catchError(() => of(undefined)),
    );
  }

  private bypassAuth(): HttpHeaders {
    return new HttpHeaders({ 'X-Bypass-Auth': '1' });
  }
}

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { EnvironmentService } from './environment.service';
import { GlobalService } from './global.service';
import { LocalStorageUtils } from '../../shared/utils';

/** Một quyền hiệu lực trả về từ GET /api/permissions/me (EffectivePermissionResponse). */
export interface EffectivePermission {
  code: string;
  name: string;
  allowed: boolean;
  effect: string;
  sourceType: 'USER' | 'TITLE' | 'ORGANIZATION' | 'ROLE' | 'DEFAULT' | 'INVALID_JSON' | string;
  sourceId: string | null;
  sourceName: string | null;
}

/** Thông tin phiên lưu ở LocalStorageUtils('accountInfo'); GlobalService.getRightsUser() đọc `rights`. */
export interface AccountInfo {
  userName: string;
  fullName: string;
  email: string;
  phone: string;
  address: string;
  organizationName: string;
  titleName: string;
  rights: string[];
  isAdmin: boolean;
  mustChangePassword: boolean;
}

export const SUPER_ADMIN = 'SUPER_ADMIN';

/** Trạng thái khuôn mặt của chính mình (GET /api/Auth/FaceStatus). */
export interface FaceGateStatus { enabled: boolean; allowed: boolean; enrolled: boolean }

/**
 * Cờ trong sessionStorage (mất khi đóng tab): bước kiểm tra khuôn mặt đã xong trong phiên trình duyệt này.
 * Đăng nhập xong (đã đăng ký, hoặc chọn "Để sau") thì đặt cờ; phiên khôi phục từ refresh token ở lần mở mới thì chưa có cờ
 * nên AuthGuard kiểm tra lại và đăng xuất tài khoản chưa có khuôn mặt.
 */
const FACE_GATE_KEY = 'smr.faceGate';

/**
 * Nạp hồ sơ + quyền của người đang đăng nhập.
 * Admin = mọi quyền đến từ role SUPER_ADMIN (PermissionServiceImpl trả sourceType ROLE, sourceId SUPER_ADMIN).
 */
@Injectable({ providedIn: 'root' })
export class SessionService {
  constructor(
    private http: HttpClient,
    private env: EnvironmentService,
    private global: GlobalService,
  ) { }

  get accountInfo(): AccountInfo | null {
    return LocalStorageUtils.getItem('accountInfo');
  }

  get isAdmin(): boolean {
    return !!this.accountInfo?.isAdmin;
  }

  /** Gọi sau đăng nhập và sau khi khôi phục phiên. Trả false nếu không nạp được hồ sơ. */
  load(extra: Partial<AccountInfo> = {}): Observable<boolean> {
    const base = this.env.getEnv('baseUrl');
    const profile$ = this.http.get<any>(`${base}/Auth/Profile`).pipe(map(res => res?.data ?? null));
    const permissions$ = this.http.get<EffectivePermission[]>(`${base}/permissions/me`).pipe(
      catchError(() => of([] as EffectivePermission[])),
    );

    return forkJoin([profile$, permissions$]).pipe(
      map(([profile, permissions]) => {
        if (!profile?.userName) {
          return false;
        }
        const list = Array.isArray(permissions) ? permissions : [];
        const current = this.accountInfo;
        const info: AccountInfo = {
          userName: profile.userName,
          fullName: profile.fullName ?? '',
          email: profile.email ?? '',
          phone: profile.phone ?? '',
          address: profile.address ?? '',
          organizationName: profile.organizationName ?? '',
          titleName: profile.titleName ?? '',
          rights: list.filter(p => p.allowed).map(p => p.code),
          // Admin = role SUPER_ADMIN hoặc được gán quyền ADMIN (toàn quyền).
          isAdmin: list.some(p => (p.sourceType === 'ROLE' && p.sourceId === SUPER_ADMIN) || (p.code === 'ADMIN' && p.allowed)),
          mustChangePassword: extra.mustChangePassword ?? current?.mustChangePassword ?? false,
        };
        LocalStorageUtils.setItem('accountInfo', info);
        this.global.accountInfoUpdated$.next(info);
        return true;
      }),
      catchError(() => of(false)),
    );
  }

  /** null nếu lỗi (không khóa người dùng chỉ vì không hỏi được trạng thái). */
  faceStatus(): Observable<FaceGateStatus | null> {
    const base = this.env.getEnv('baseUrl');
    return this.http.get<any>(`${base}/Auth/FaceStatus`).pipe(
      map(res => (res?.data ?? null) as FaceGateStatus | null),
      catchError(() => of(null)),
    );
  }

  isFaceGateDone(): boolean {
    try { return sessionStorage.getItem(FACE_GATE_KEY) === '1'; } catch { return false; }
  }

  markFaceGateDone(): void {
    try { sessionStorage.setItem(FACE_GATE_KEY, '1'); } catch { /* sessionStorage bị chặn */ }
  }

  resetFaceGate(): void {
    try { sessionStorage.removeItem(FACE_GATE_KEY); } catch { /* sessionStorage bị chặn */ }
  }

  setMustChangePassword(value: boolean): void {
    this.global.updateStoredAccountInfo({ mustChangePassword: value });
  }

  clear(): void {
    LocalStorageUtils.clear();
  }
}

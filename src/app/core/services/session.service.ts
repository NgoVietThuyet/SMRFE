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
          isAdmin: list.some(p => p.sourceType === 'ROLE' && p.sourceId === SUPER_ADMIN),
          mustChangePassword: extra.mustChangePassword ?? current?.mustChangePassword ?? false,
        };
        LocalStorageUtils.setItem('accountInfo', info);
        this.global.accountInfoUpdated$.next(info);
        return true;
      }),
      catchError(() => of(false)),
    );
  }

  setMustChangePassword(value: boolean): void {
    this.global.updateStoredAccountInfo({ mustChangePassword: value });
  }

  clear(): void {
    LocalStorageUtils.clear();
  }
}

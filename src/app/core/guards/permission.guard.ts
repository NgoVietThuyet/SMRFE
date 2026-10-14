import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivate, CanActivateChild, Router } from '@angular/router';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { GlobalService } from '../services/global.service';
import { SessionService } from '../services/session.service';

/**
 * Kiểm tra route.data.requiredRight (một mã hoặc mảng, chỉ cần có 1 mã — mã lấy từ PermissionCatalog).
 * Thiếu quyền thì nạp lại quyền từ server một lần (admin vừa đổi quyền) rồi mới chặn.
 * Chỉ để ẩn giao diện — BE vẫn tự kiểm tra quyền ở từng API.
 */
@Injectable({
    providedIn: 'root'
})
export class PermissionGuard implements CanActivate, CanActivateChild {
    constructor(
        private router: Router,
        private globalService: GlobalService,
        private session: SessionService,
    ) { }

    canActivate(route: ActivatedRouteSnapshot): Observable<boolean> | boolean {
        return this.check(route);
    }

    canActivateChild(childRoute: ActivatedRouteSnapshot): Observable<boolean> | boolean {
        return this.check(childRoute);
    }

    private check(route: ActivatedRouteSnapshot): Observable<boolean> | boolean {
        const requiredRight = route.data?.['requiredRight'] as string | string[] | undefined;
        if (!requiredRight || this.session.isAdmin || this.globalService.hasAnyRight(requiredRight)) {
            return true;
        }

        return this.session.load().pipe(
            map(() => {
                if (this.session.isAdmin || this.globalService.hasAnyRight(requiredRight)) {
                    return true;
                }
                this.router.navigate(['/not-permission']);
                return false;
            }),
        );
    }
}

export default PermissionGuard;

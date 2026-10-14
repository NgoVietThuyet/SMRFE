import { Injectable } from '@angular/core';
import { CanActivate, CanActivateChild, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { SessionService } from '../services/session.service';

/** Nhóm /admin/** — chỉ tài khoản SUPER_ADMIN. Nạp lại phiên một lần trước khi chặn (quyền vừa được cấp). */
@Injectable({
    providedIn: 'root'
})
export class AdminGuard implements CanActivate, CanActivateChild {
    constructor(
        private router: Router,
        private session: SessionService,
    ) { }

    canActivate(): Observable<boolean> | boolean {
        return this.check();
    }

    canActivateChild(): Observable<boolean> | boolean {
        return this.check();
    }

    private check(): Observable<boolean> | boolean {
        if (this.session.isAdmin) {
            return true;
        }
        return this.session.load().pipe(
            map(() => {
                if (this.session.isAdmin) {
                    return true;
                }
                this.router.navigate(['/not-permission']);
                return false;
            }),
        );
    }
}

export default AdminGuard;

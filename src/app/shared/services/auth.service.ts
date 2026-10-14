import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CommonService, ApiResponse } from './common.service';
import { AuthResult } from '../../core';

/** /api/Auth của BE-Java (trừ Refresh/Logout nằm ở TokenService). */
@Injectable({
    providedIn: 'root',
})
export class AuthService {
    constructor(private common: CommonService) { }

    login(data: { userName: string; password: string }): Observable<ApiResponse<AuthResult>> { return this.common.post<ApiResponse<AuthResult>>('Auth/Login', data, true, false) }

    getProfile(): Observable<any> { return this.common.get('Auth/Profile') }

    updateProfile(data: { fullName: string; email: string; phone: string; address: string }): Observable<ApiResponse> { return this.common.put('Auth/Profile', data) }

    changePassword(data: { currentPassword: string; newPassword: string }): Observable<ApiResponse> { return this.common.post('Auth/ChangePassword', data) }

    forgotPassword(email: string): Observable<ApiResponse<string>> { return this.common.post<ApiResponse<string>>('Auth/ForgotPassword', { email }) }

    resetPassword(data: { resetToken: string; newPassword: string }): Observable<ApiResponse> { return this.common.post('Auth/ResetPassword', data) }
}

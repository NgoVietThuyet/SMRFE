import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CommonService, ApiResponse } from './common.service';
import { AuthResult } from '../../core';

export type FaceGestureName = 'BLINK' | 'TURN_LEFT' | 'TURN_RIGHT';

/** FaceChallengeResponse — GET /api/Auth/FaceChallenge. */
export interface FaceChallenge { enabled: boolean; challengeId: string | null; gesture: FaceGestureName | null; ttlSeconds: number }

/** FaceStatusResponse — GET /api/Auth/FaceStatus. */
export interface FaceStatus { enabled: boolean; allowed: boolean; enrolled: boolean; samples: number }

/** /api/Auth của BE-Java (trừ Refresh/Logout nằm ở TokenService). */
@Injectable({
    providedIn: 'root',
})
export class AuthService {
    constructor(private common: CommonService) { }

    login(data: { userName: string; password: string }): Observable<ApiResponse<AuthResult>> { return this.common.post<ApiResponse<AuthResult>>('Auth/Login', data, true, false) }

    // ===================== Khuôn mặt =====================

    faceChallenge(): Observable<FaceChallenge> { return this.common.get<FaceChallenge>('Auth/FaceChallenge', null, false) }

    faceLogin(data: { userName: string; challengeId: string; frames: string[] }): Observable<ApiResponse<AuthResult>> {
        return this.common.post<ApiResponse<AuthResult>>('Auth/FaceLogin', data, true, false)
    }

    faceJoin(data: { roomCode: string; challengeId: string; frames: string[] }): Observable<ApiResponse<AuthResult>> {
        return this.common.post<ApiResponse<AuthResult>>('Auth/FaceJoin', data, true, false)
    }

    faceEnroll(data: { password: string; consent: boolean; frames: string[] }): Observable<ApiResponse> { return this.common.post('Auth/FaceEnroll', data, true, true) }

    faceStatus(): Observable<FaceStatus> { return this.common.get<FaceStatus>('Auth/FaceStatus', null, false) }

    faceRemove(): Observable<ApiResponse> { return this.common.delete('Auth/FaceRemove') }

    getProfile(): Observable<any> { return this.common.get('Auth/Profile') }

    updateProfile(data: { fullName: string; email: string; phone: string; address: string }): Observable<ApiResponse> { return this.common.put('Auth/Profile', data) }

    changePassword(data: { currentPassword: string; newPassword: string }): Observable<ApiResponse> { return this.common.post('Auth/ChangePassword', data) }

    forgotPassword(email: string): Observable<ApiResponse<string>> { return this.common.post<ApiResponse<string>>('Auth/ForgotPassword', { email }) }

    resetPassword(data: { resetToken: string; newPassword: string }): Observable<ApiResponse> { return this.common.post('Auth/ResetPassword', data) }
}

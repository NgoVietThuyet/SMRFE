import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { EnvironmentService, TokenService } from '../../../core';
import { ApiResponse, CommonService } from '../../../shared/services';
import {
    AttendanceSummary, ChatMessage, EnterRoomResult, JoinInfo, LobbyRequest, PublicMeeting, RoomParticipant, WhiteboardState,
} from '../models/room.models';

/** API phòng họp (P10): /api/Meeting/{id}/room/**, join-info, messages, attendance, Auth/GuestSession. */
@Injectable({
    providedIn: 'root',
})
export class RoomService {
    constructor(private common: CommonService, private http: HttpClient, private env: EnvironmentService, private tokens: TokenService) { }

    private base(id: string): string {
        return `Meeting/${encodeURIComponent(id)}`;
    }

    // ----- Vào phòng / phòng chờ
    enter(id: string): Observable<EnterRoomResult> {
        return this.common.post<ApiResponse<EnterRoomResult>>(`${this.base(id)}/room/enter`, null, false, false).pipe(map(r => r.data));
    }

    requestAgain(id: string): Observable<EnterRoomResult> {
        return this.common.post<ApiResponse<EnterRoomResult>>(`${this.base(id)}/room/lobby/request`, null, false, false).pipe(map(r => r.data));
    }

    lobby(id: string): Observable<LobbyRequest[]> { return this.common.get<LobbyRequest[]>(`${this.base(id)}/room/lobby`, null, false) }

    admit(id: string, requestId: string): Observable<ApiResponse> { return this.common.post(`${this.base(id)}/room/lobby/${encodeURIComponent(requestId)}/admit`, null, false, false) }

    reject(id: string, requestId: string): Observable<ApiResponse> { return this.common.post(`${this.base(id)}/room/lobby/${encodeURIComponent(requestId)}/reject`, null, false, false) }

    admitAll(id: string): Observable<ApiResponse> { return this.common.post(`${this.base(id)}/room/lobby/admit-all`, null, false, false) }

    joinInfo(id: string): Observable<JoinInfo> { return this.common.get<JoinInfo>(`${this.base(id)}/join-info`, null, false) }

    /** Đánh dấu IsJoined (thời lượng tính từ hub JoinMeeting/LeaveMeeting). */
    markJoined(id: string): Observable<ApiResponse> { return this.common.post(`${this.base(id)}/join`, null, false, false) }

    /** Rời phòng — dùng được cả khi đóng tab (keepalive). */
    markLeft(id: string): void {
        const token = this.tokens.getAccessToken();
        fetch(`${this.env.getEnv('baseUrl')}/${this.base(id)}/leave`, {
            method: 'POST', keepalive: true,
            headers: { 'X-Requested-With': 'XMLHttpRequest', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        }).catch(() => { /* bỏ qua */ });
    }

    start(id: string): Observable<ApiResponse> { return this.common.post(`${this.base(id)}/start`, null, true, false) }

    end(id: string): Observable<ApiResponse> { return this.common.post(`${this.base(id)}/end`, null, true, false) }

    // ----- Thành viên
    participants(id: string): Observable<RoomParticipant[]> { return this.common.get<RoomParticipant[]>(`${this.base(id)}/room/participants`, null, false) }

    mute(id: string, userName: string): Observable<ApiResponse> { return this.common.post(`${this.base(id)}/room/participants/${encodeURIComponent(userName)}/mute`, null, false, false) }

    kick(id: string, userName: string): Observable<ApiResponse> { return this.common.post(`${this.base(id)}/room/participants/${encodeURIComponent(userName)}/kick`, null, false) }

    changeRole(id: string, userName: string, role: number): Observable<ApiResponse> {
        return this.common.put(`${this.base(id)}/room/participants/${encodeURIComponent(userName)}/role`, { role }, false);
    }

    // ----- Chat
    messages(id: string): Observable<ChatMessage[]> { return this.common.get<ChatMessage[]>(`${this.base(id)}/messages`, null, false) }

    send(id: string, messageText: string, receiverUserId: string | null): Observable<ChatMessage> {
        return this.common.post<ApiResponse<ChatMessage>>(`${this.base(id)}/messages`, { meetingId: id, messageText, receiverUserId: receiverUserId ?? '' }, false, false)
            .pipe(map(r => r.data));
    }

    // ----- Bảng trắng (409 → body.data là bản hiện tại; gọi thẳng HttpClient để tự xử lý, không hiện thông báo lỗi)
    whiteboard(id: string): Observable<WhiteboardState> { return this.common.get<WhiteboardState>(`${this.base(id)}/room/whiteboard`, null, false) }

    saveWhiteboard(id: string, baseRevision: number, contentJson: string): Observable<WhiteboardState> {
        return this.http.put<ApiResponse<WhiteboardState>>(`${this.env.getEnv('baseUrl')}/${this.base(id)}/room/whiteboard`,
            { baseRevision, contentJson }).pipe(map(r => r.data));
    }

    lockWhiteboard(id: string, on: boolean): Observable<ApiResponse<WhiteboardState>> {
        return this.common.post<ApiResponse<WhiteboardState>>(`${this.base(id)}/room/whiteboard/lock`, { on }, false, false);
    }

    recording(id: string, on: boolean): Observable<ApiResponse> { return this.common.post(`${this.base(id)}/room/recording`, { on }, false, false) }

    // ----- Tham dự
    attendance(id: string): Observable<AttendanceSummary[]> { return this.common.get<AttendanceSummary[]>(`${this.base(id)}/attendance`, null, false) }

    exportAttendance(id: string): Observable<{ blob: Blob; fileName: string }> {
        return this.common.downloadFile(`${this.base(id)}/attendance/export`, null, true).pipe(map(res => {
            const disposition = res.headers.get('Content-Disposition') ?? '';
            const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition);
            const fileName = decodeURIComponent(match?.[1] ?? match?.[2] ?? 'ThamDu.xlsx');
            return { blob: res.body as Blob, fileName };
        }));
    }

    // ----- Khách (/join/:roomCode)
    publicInfo(roomCode: string): Observable<PublicMeeting> {
        return this.common.get<PublicMeeting>(`Meeting/public/${encodeURIComponent(roomCode)}`, null, false);
    }

    guestSession(meetingId: string, displayName: string): Observable<ApiResponse<{ token: string; userName: string; fullName: string } | null>> {
        return this.common.post('Auth/GuestSession', { meetingId, displayName }, true, false);
    }
}

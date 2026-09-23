import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, of } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { ApiResponse } from '../models/auth.models';
import {
    AddParticipantsRequest,
    CancelMeetingRequest,
    ChatMessage,
    CreateMeetingRequest,
    CreateMeetingResponse,
    FileDownloadDto,
    MeetingDetailDto,
    MeetingFileDto,
    MeetingJoinInfo,
    MeetingSearchRequest,
    PagedMeetings,
    UpdateMeetingRequest,
    UserSearchItem,
} from '../models/meeting.models';

@Injectable({ providedIn: 'root' })
export class MeetingService {
    private readonly http = inject(HttpClient);

    // POST /api/Meeting — BE ném ArgumentException → 400 {status:false,message}
    create(payload: CreateMeetingRequest): Observable<string> {
        return this.http
            .post<CreateMeetingResponse>(`${API_BASE_URL}/api/Meeting`, payload)
            .pipe(
                map((res) => {
                    if (!res.status || !res.data?.id) {
                        throw new Error(res.message || 'Tạo cuộc họp thất bại.');
                    }
                    return res.data.id;
                })
            );
    }

    // POST /api/Meeting/query — tab/status/keyword/date + phân trang server-side
    query(dto: MeetingSearchRequest): Observable<PagedMeetings> {
        return this.http
            .post<ApiResponse<PagedMeetings>>(`${API_BASE_URL}/api/Meeting/query`, dto)
            .pipe(
                map((res) => {
                    if (!res.status || !res.data) {
                        throw new Error(res.message || 'Không thể tải danh sách cuộc họp.');
                    }
                    return res.data;
                })
            );
    }

    // GET /api/Meeting/{id} — chi tiết đầy đủ (participants, activity, settings)
    getDetail(id: string): Observable<MeetingDetailDto> {
        return this.http
            .get<ApiResponse<MeetingDetailDto>>(`${API_BASE_URL}/api/Meeting/${id}`)
            .pipe(
                map((res) => {
                    if (!res.status || !res.data) {
                        throw new Error(res.message || 'Không tìm thấy cuộc họp.');
                    }
                    return res.data;
                })
            );
    }

    // GET /api/Meeting/{id}/join-info — room Jitsi + cờ moderator/mute
    getJoinInfo(id: string): Observable<MeetingJoinInfo> {
        return this.http
            .get<ApiResponse<MeetingJoinInfo>>(`${API_BASE_URL}/api/Meeting/${id}/join-info`)
            .pipe(
                map((res) => {
                    if (!res.status || !res.data) {
                        throw new Error(res.message || 'Không thể lấy thông tin phòng họp.');
                    }
                    return res.data;
                })
            );
    }

    // POST /api/Meeting/{id}/join — điểm danh vào phòng (chỉ khi Ongoing)
    join(id: string): Observable<void> {
        return this.http
            .post<ApiResponse<null>>(`${API_BASE_URL}/api/Meeting/${id}/join`, {})
            .pipe(map(() => undefined));
    }

    // POST /api/Meeting/{id}/leave — điểm danh rời phòng.
    // API lỗi vẫn resolve để caller dọn local (đã rời iframe).
    leave(id: string): Observable<void> {
        return this.http
            .post<ApiResponse<null>>(`${API_BASE_URL}/api/Meeting/${id}/leave`, {})
            .pipe(
                catchError(() => of(null)),
                map(() => undefined)
            );
    }

    // POST /api/Meeting/{id}/start — host mở phòng (Scheduled → Ongoing)
    start(id: string): Observable<void> {
        return this.http
            .post<ApiResponse<null>>(`${API_BASE_URL}/api/Meeting/${id}/start`, {})
            .pipe(
                map((res) => {
                    if (!res.status) throw new Error(res.message || 'Không thể bắt đầu cuộc họp.');
                })
            );
    }

    // POST /api/Meeting/{id}/end — host kết thúc (Ongoing → Ended)
    end(id: string): Observable<void> {
        return this.http
            .post<ApiResponse<null>>(`${API_BASE_URL}/api/Meeting/${id}/end`, {})
            .pipe(
                map((res) => {
                    if (!res.status) throw new Error(res.message || 'Không thể kết thúc cuộc họp.');
                })
            );
    }

    // GET /api/Meeting/{id}/messages — lịch sử chat (Data = mảng)
    getMessages(id: string): Observable<ChatMessage[]> {
        return this.http
            .get<ApiResponse<ChatMessage[]>>(`${API_BASE_URL}/api/Meeting/${id}/messages`)
            .pipe(map((res) => res.data ?? []));
    }

    // POST /api/Meeting/{id}/messages — gửi chat, Data = message vừa tạo
    sendMessage(id: string, messageText: string): Observable<ChatMessage> {
        return this.http
            .post<ApiResponse<ChatMessage>>(`${API_BASE_URL}/api/Meeting/${id}/messages`, {
                meetingId: id,
                messageText,
            })
            .pipe(
                map((res) => {
                    if (!res.status || !res.data) {
                        throw new Error(res.message || 'Không gửi được tin nhắn.');
                    }
                    return res.data;
                })
            );
    }

    // PATCH /api/Meeting/{id} — host/cohost, không áp dụng khi ended/cancelled/archived
    update(id: string, payload: UpdateMeetingRequest): Observable<MeetingDetailDto> {
        return this.http
            .patch<ApiResponse<MeetingDetailDto>>(`${API_BASE_URL}/api/Meeting/${id}`, {
                id,
                ...payload,
            })
            .pipe(
                map((res) => {
                    if (!res.status || !res.data) {
                        throw new Error(res.message || 'Cập nhật cuộc họp thất bại.');
                    }
                    return res.data;
                })
            );
    }

    // POST /api/Meeting/{id}/cancel — chỉ Draft/Scheduled
    cancel(id: string, reason: string): Observable<void> {
        const body: CancelMeetingRequest = { reason: reason.trim() };
        return this.http
            .post<ApiResponse<null>>(`${API_BASE_URL}/api/Meeting/${id}/cancel`, {
                meetingId: id,
                ...body,
            })
            .pipe(
                map((res) => {
                    if (!res.status) throw new Error(res.message || 'Hủy cuộc họp thất bại.');
                })
            );
    }

    // POST /api/Meeting/{id}/participants — BE trả về detail mới
    addParticipants(id: string, userNames: string[]): Observable<MeetingDetailDto> {
        const body: AddParticipantsRequest = { userNames };
        return this.http
            .post<ApiResponse<MeetingDetailDto>>(`${API_BASE_URL}/api/Meeting/${id}/participants`, {
                meetingId: id,
                ...body,
            })
            .pipe(
                map((res) => {
                    if (!res.status || !res.data) {
                        throw new Error(res.message || 'Thêm người tham gia thất bại.');
                    }
                    return res.data;
                })
            );
    }

    // DELETE /api/Meeting/{id}/participants/{userName}
    removeParticipant(id: string, userName: string): Observable<void> {
        return this.http
            .delete<ApiResponse<null>>(
                `${API_BASE_URL}/api/Meeting/${id}/participants/${encodeURIComponent(userName)}`
            )
            .pipe(
                map((res) => {
                    if (!res.status) throw new Error(res.message || 'Xóa người tham gia thất bại.');
                })
            );
    }

    // GET /api/File/GetMeetingFiles/{meetingId} — cả tài liệu + recordings
    getFiles(meetingId: string): Observable<MeetingFileDto[]> {
        return this.http
            .get<MeetingFileDto[]>(`${API_BASE_URL}/api/File/GetMeetingFiles/${meetingId}`)
            .pipe(map((files) => files ?? []));
    }

    // POST /api/File/Meetings/{meetingId}/files — user (member) tải tài liệu lên, Type=1
    uploadMeetingFile(meetingId: string, file: File): Observable<MeetingFileDto> {
        const form = new FormData();
        form.append('file', file, file.name);
        return this.http
            .post<MeetingFileDto>(`${API_BASE_URL}/api/File/Meetings/${meetingId}/files`, form)
            .pipe(
                map((res) => {
                    if (!res?.id) throw new Error('Tải tài liệu lên thất bại.');
                    return res;
                })
            );
    }

    // GET /api/File/Download/{fileId} — BE trả raw {url, expiresIn}, url ký 900s
    downloadUrl(fileId: string): Observable<string> {
        return this.http
            .get<FileDownloadDto>(`${API_BASE_URL}/api/File/Download/${fileId}`)
            .pipe(
                map((res) => {
                    if (!res?.url) throw new Error('Không lấy được link tải.');
                    return res.url;
                })
            );
    }

    // GET /api/User/Search — BE yêu cầu q ≥ 1 ký tự, take ≤ 20
    searchUsers(query: string, take = 10): Observable<UserSearchItem[]> {
        const q = query.trim();
        if (!q) return of([]);
        const params = new HttpParams().set('q', q).set('take', take);
        return this.http
            .get<UserSearchItem[]>(`${API_BASE_URL}/api/User/Search`, { params })
            .pipe(map((users) => users ?? []));
    }
}

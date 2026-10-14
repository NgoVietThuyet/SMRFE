import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiResponse, CommonService, PagedResult } from '../../../shared/services';
import { TaskSearchResult } from '../../dashboard/models/dashboard.models';
import {
    CreateMeetingDto, MeetingDetail, MeetingFile, MeetingListItem, MeetingParticipantInput, MeetingQuery,
    ScheduleConflict, UpdateMeetingDto, UserSearchItem,
} from '../models/meeting.models';

/** API "Cuộc họp của tôi" (P9): /api/Meeting/*, /api/File/* (tài liệu), /api/Task/query (công việc của cuộc họp). */
@Injectable({
    providedIn: 'root',
})
export class MeetingService {
    constructor(private common: CommonService) { }

    query(query: Partial<MeetingQuery>, showLoading = true): Observable<PagedResult<MeetingListItem>> {
        const body: MeetingQuery = { tab: 'all', keyword: '', status: null, page: 1, pageSize: 20, startDate: null, endDate: null, ...query };
        return this.common.post<ApiResponse<PagedResult<MeetingListItem>>>('Meeting/query', body, showLoading, false).pipe(map(res => res.data));
    }

    detail(id: string, showLoading = true): Observable<MeetingDetail> { return this.common.get<MeetingDetail>(`Meeting/${encodeURIComponent(id)}`, null, showLoading) }

    create(dto: CreateMeetingDto): Observable<MeetingDetail> { return this.common.post<ApiResponse<MeetingDetail>>('Meeting', dto).pipe(map(res => res.data)) }

    update(id: string, dto: UpdateMeetingDto): Observable<MeetingDetail> { return this.common.patch<ApiResponse<MeetingDetail>>(`Meeting/${encodeURIComponent(id)}`, dto).pipe(map(res => res.data)) }

    remove(id: string): Observable<ApiResponse> { return this.common.delete(`Meeting/${encodeURIComponent(id)}`) }

    cancel(id: string, reason: string): Observable<ApiResponse> { return this.common.post(`Meeting/${encodeURIComponent(id)}/cancel`, { meetingId: id, reason }) }

    archive(id: string): Observable<ApiResponse> { return this.common.post(`Meeting/${encodeURIComponent(id)}/archive`, null) }

    start(id: string): Observable<ApiResponse> { return this.common.post(`Meeting/${encodeURIComponent(id)}/start`, null) }

    addParticipants(id: string, participants: MeetingParticipantInput[]): Observable<MeetingDetail> {
        return this.common.post<ApiResponse<MeetingDetail>>(`Meeting/${encodeURIComponent(id)}/participants`, { participants }).pipe(map(res => res.data));
    }

    removeParticipant(id: string, userName: string): Observable<ApiResponse> {
        return this.common.delete(`Meeting/${encodeURIComponent(id)}/participants/${encodeURIComponent(userName)}`);
    }

    /** Cảnh báo trùng lịch (không chặn lưu). Gồm cả người đang đăng nhập. */
    conflicts(startTime: string, endTime: string, userNames: string[], excludeMeetingId: string | null): Observable<ScheduleConflict[]> {
        return this.common.post<ApiResponse<ScheduleConflict[]>>('Meeting/schedule-conflicts', { startTime, endTime, userNames, excludeMeetingId }, false, false)
            .pipe(map(res => res.data ?? []));
    }

    searchUsers(q: string, take = 10): Observable<UserSearchItem[]> { return this.common.get<UserSearchItem[]>('User/Search', { q, take }, false) }

    // ----- Tài liệu (FileController trả object thuần, không bọc ApiResponse)
    files(meetingId: string): Observable<MeetingFile[]> { return this.common.get<MeetingFile[]>(`File/GetMeetingFiles/${encodeURIComponent(meetingId)}`, null, false) }

    uploadFile(meetingId: string, file: File): Observable<MeetingFile> {
        return this.common.uploadFiles(`File/Meetings/${encodeURIComponent(meetingId)}/files`, [file], 'file', undefined, true, false).pipe(map(res => res.data));
    }

    downloadUrl(fileId: string): Observable<{ url: string; expiresIn: number }> {
        return this.common.get<{ url: string; expiresIn: number }>(`File/Download/${encodeURIComponent(fileId)}`, null, false);
    }

    // ----- Công việc của cuộc họp
    tasks(meetingId: string): Observable<TaskSearchResult> {
        return this.common.post<ApiResponse<TaskSearchResult>>('Task/query', { shortcut: 'all', keyword: '', meetingId, page: 1, pageSize: 100 }, false, false)
            .pipe(map(res => res.data));
    }
}

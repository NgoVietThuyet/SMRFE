import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { CommonService, PagedResult } from '../../../shared/services';
import {
    MeetingCodeLookup, MeetingDashboard, MeetingListItem, MeetingQuery, TaskQuery, TaskSearchResult, UserSearchItem,
} from '../models/dashboard.models';

/** API dùng cho trang Tổng quan (P8). Lần làm mới nền thì tắt loading toàn trang. */
@Injectable({
    providedIn: 'root',
})
export class DashboardService {
    constructor(private common: CommonService) { }

    dashboard(showLoading = false): Observable<MeetingDashboard> { return this.common.get<MeetingDashboard>('Meeting/dashboard', null, showLoading) }

    meetings(query: Partial<MeetingQuery>, showLoading = false): Observable<PagedResult<MeetingListItem>> {
        const body: MeetingQuery = { tab: 'all', keyword: '', status: null, page: 1, pageSize: 10, startDate: null, endDate: null, ...query };
        return this.common.post<any>('Meeting/query', body, showLoading, false).pipe(map(res => res.data));
    }

    tasks(query: Partial<TaskQuery>, showLoading = false): Observable<TaskSearchResult> {
        const body: TaskQuery = { shortcut: 'all', keyword: '', assignee: null, page: 1, pageSize: 5, ...query };
        return this.common.post<any>('Task/query', body, showLoading, false).pipe(map(res => res.data));
    }

    /** Luôn trả 200; không tìm thấy / không được mời thể hiện qua reason. */
    lookupByCode(roomCode: string): Observable<MeetingCodeLookup> { return this.common.get<MeetingCodeLookup>(`Meeting/by-code/${encodeURIComponent(roomCode)}`, null, false) }

    quickMeeting(name: string, participantUserNames: string[]): Observable<{ id: string }> { return this.common.post<any>('Meeting/quick', { name, participantUserNames }, true, false).pipe(map(res => res.data)) }

    searchUsers(q: string, take = 10): Observable<UserSearchItem[]> { return this.common.get<UserSearchItem[]>('User/Search', { q, take }, false) }
}

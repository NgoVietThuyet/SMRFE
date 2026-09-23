import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
    DashboardResponse,
    MeetingDashboardDto,
    MeetingListItemDto,
    MeetingStatus,
} from '../models/dashboard.models';
import { ApiResponse } from '../models/auth.models';

// Kết quả bổ sung: recent meetings (đã kết thúc gần đây)
export interface RecentMeetingsResponse {
    items: MeetingListItemDto[];
    totalItems: number;
}

export interface DashboardPageData {
    dashboard: MeetingDashboardDto;
    recentMeetings: MeetingListItemDto[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
    private readonly http = inject(HttpClient);

    // GET /api/Meeting/dashboard
    getDashboard(): Observable<MeetingDashboardDto> {
        return this.http
            .get<DashboardResponse>(`${API_BASE_URL}/api/Meeting/dashboard`)
            .pipe(
                map((res) => {
                    if (!res.status || !res.data) {
                        throw new Error(res.message || 'Không thể tải dữ liệu tổng quan.');
                    }
                    return res.data;
                })
            );
    }

    // POST /api/Meeting/query — lấy 5 cuộc họp đã kết thúc gần nhất
    getRecentEndedMeetings(pageSize = 5): Observable<MeetingListItemDto[]> {
        return this.http
            .post<ApiResponse<{ items: MeetingListItemDto[]; totalItems: number }>>(
                `${API_BASE_URL}/api/Meeting/query`,
                { tab: 'ended', page: 1, pageSize }
            )
            .pipe(
                map((res) => {
                    if (!res.status || !res.data) return [];
                    return res.data.items ?? [];
                })
            );
    }

    // Gọi song song dashboard + recent meetings
    getAll(): Observable<DashboardPageData> {
        return forkJoin({
            dashboard: this.getDashboard(),
            recentMeetings: this.getRecentEndedMeetings(),
        });
    }

    // Helper: phân loại meeting thành canJoin (đang diễn ra, hoặc sắp diễn ra ≤ 5 phút nữa)
    static canJoin(meeting: MeetingListItemDto): boolean {
        if (meeting.status === MeetingStatus.Ongoing) return true;
        if (meeting.status === MeetingStatus.Scheduled) {
            const now = Date.now();
            const start = new Date(meeting.expectedStartTime).getTime();
            return start - now <= 5 * 60 * 1000; // ≤ 5 phút
        }
        return false;
    }
}

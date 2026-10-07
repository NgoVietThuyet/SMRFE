import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, forkJoin, map, Observable, of } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
    DashboardResponse,
    MeetingDashboardDto,
    MeetingListItemDto,
    MeetingStatus,
} from '../models/dashboard.models';
import { ApiResponse } from '../models/auth.models';
import { MeetingService } from './meeting.service';
import { TaskService } from './task.service';
import { PagedMeetings } from '../models/meeting.models';
import { TaskListItem, TaskStatus } from '../models/task.models';

export interface DashboardTasks {
    items: TaskListItem[];
    total: number;
}

// Kết quả bổ sung: recent meetings (đã kết thúc gần đây)
export interface RecentMeetingsResponse {
    items: MeetingListItemDto[];
    totalItems: number;
}

export interface DashboardPageData {
    dashboard: MeetingDashboardDto;
    recentMeetings: MeetingListItemDto[];
    today: PagedMeetings | null;
    tasks: DashboardTasks | null;
    recentError: boolean;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
    private readonly http = inject(HttpClient);
    private readonly meetings = inject(MeetingService);
    private readonly tasks = inject(TaskService);

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
                    if (!res.status || !res.data) throw new Error(res.message || 'Không thể tải cuộc họp gần đây.');
                    return res.data.items ?? [];
                })
            );
    }

    // Gọi song song dashboard + recent meetings
    getAll(): Observable<DashboardPageData> {
        return forkJoin({
            dashboard: this.getDashboard(),
            recent: this.getRecentEndedMeetings(3).pipe(
                map(items => ({ items, error: false })),
                catchError(() => of({ items: [] as MeetingListItemDto[], error: true })),
            ),
            today: this.getToday().pipe(catchError(() => of(null))),
            tasks: this.getActionableTasks().pipe(catchError(() => of(null))),
        }).pipe(map(({ recent, ...data }) => ({
            ...data, recentMeetings: recent.items, recentError: recent.error,
        })));
    }

    getToday(now = new Date()): Observable<PagedMeetings> {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        end.setMilliseconds(-1);
        return this.meetings.query({
            tab: 'all', keyword: '', status: null, page: 1, pageSize: 100,
            startDate: start.toISOString(), endDate: end.toISOString(),
        }).pipe(map(result => ({
            ...result,
            items: [...result.items].sort((a, b) => Date.parse(a.expectedStartTime) - Date.parse(b.expectedStartTime)),
        })));
    }

    getActionableTasks(): Observable<DashboardTasks> {
        // Query both unfinished statuses so completed rows never distort the total.
        const query = (status: TaskStatus) => this.tasks.query({
            shortcut: 'mine', keyword: '', meetingId: null, assignee: null,
            status, priority: null, page: 1, pageSize: 50,
        });
        return forkJoin([query(TaskStatus.NotStarted), query(TaskStatus.InProgress)]).pipe(
            map(results => ({
                total: results.reduce((sum, result) => sum + result.totalItems, 0),
                items: results.flatMap(result => result.items)
                    .sort((a, b) => (a.dueDate ? Date.parse(a.dueDate) : Infinity)
                        - (b.dueDate ? Date.parse(b.dueDate) : Infinity) || b.priority - a.priority)
                    .slice(0, 4),
            })),
        );
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

import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { ApiResponse } from '../models/auth.models';
import { NotificationPage, UnreadCount } from '../models/notification.models';

// NotificationService — gọi /api/Notification. Mọi API chỉ trên thông báo của người đang đăng nhập
// (BE lấy chủ sở hữu từ JWT; id của người khác → 404).
@Injectable({ providedIn: 'root' })
export class NotificationService {
    private readonly http = inject(HttpClient);
    private readonly base = `${API_BASE_URL}/api/Notification`;

    list(filter: 'all' | 'unread', cursor: string | null, pageSize = 20): Observable<NotificationPage> {
        let params = new HttpParams().set('filter', filter).set('pageSize', pageSize);
        if (cursor) params = params.set('cursor', cursor);
        return this.http.get<ApiResponse<NotificationPage>>(this.base, { params }).pipe(
            map((res) => unwrap(res, 'Không tải được thông báo.'))
        );
    }

    unreadCount(): Observable<number> {
        return this.http.get<ApiResponse<UnreadCount>>(`${this.base}/unread-count`).pipe(
            map((res) => unwrap(res, 'Không tải được số thông báo.').unreadCount)
        );
    }

    markRead(id: string, isRead = true): Observable<number> {
        return this.http.patch<ApiResponse<UnreadCount>>(`${this.base}/${id}/read`, { isRead }).pipe(
            map((res) => unwrap(res, 'Không cập nhật được thông báo.').unreadCount)
        );
    }

    markAllRead(before: string): Observable<number> {
        return this.http.post<ApiResponse<UnreadCount>>(`${this.base}/read-all`, { before }).pipe(
            map((res) => unwrap(res, 'Không cập nhật được thông báo.').unreadCount)
        );
    }

    remove(id: string): Observable<void> {
        return this.http.delete<ApiResponse<null>>(`${this.base}/${id}`).pipe(
            map((res) => {
                if (!res.status) throw new Error(res.message || 'Không xóa được thông báo.');
            })
        );
    }
}

function unwrap<T>(res: ApiResponse<T>, fallback: string): T {
    if (!res.status || res.data == null) throw new Error(res.message || fallback);
    return res.data;
}

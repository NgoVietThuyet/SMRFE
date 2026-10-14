import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CommonService } from './common.service';
import { NotificationPage } from '../models';

/** /api/Notification — trung tâm thông báo của người đang đăng nhập (chân sidebar). */
@Injectable({
    providedIn: 'root',
})
export class NotificationService {
    constructor(private common: CommonService) { }

    list(filter: 'all' | 'unread' = 'all', cursor: string | null = null, pageSize = 20): Observable<NotificationPage> { return this.common.get<NotificationPage>('Notification', { filter, cursor, pageSize }, false) }

    unreadCount(): Observable<number> { return this.common.get<{ unreadCount: number }>('Notification/unread-count', null, false).pipe(map(res => res?.unreadCount ?? 0)) }

    markRead(id: string, isRead = true): Observable<number> { return this.common.patch<any>(`Notification/${encodeURIComponent(id)}/read`, { isRead }, false, false).pipe(map(res => res?.data?.unreadCount ?? 0)) }

    readAll(before: string | null = null): Observable<number> { return this.common.post<any>('Notification/read-all', { before }, false, false).pipe(map(res => res?.data?.unreadCount ?? 0)) }

    remove(id: string): Observable<any> { return this.common.delete(`Notification/${encodeURIComponent(id)}`, null, false, false) }
}

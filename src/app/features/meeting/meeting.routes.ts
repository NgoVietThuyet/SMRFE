import { Routes } from '@angular/router';

/** P9 — Cuộc họp của tôi. Phòng họp `/meetings/:id/join` khai báo ở app.routes (P10). */
export const meetingRoutes: Routes = [
    { path: '', loadComponent: () => import('./components/meeting-list/meeting-list').then(m => m.MeetingList) },
    { path: ':id', loadComponent: () => import('./components/meeting-detail/meeting-detail').then(m => m.MeetingDetailPage) },
];

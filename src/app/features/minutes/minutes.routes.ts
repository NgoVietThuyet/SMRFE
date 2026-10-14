import { Routes } from '@angular/router';

/** P13 — Biên bản họp: danh sách + trình soạn theo cuộc họp. */
export const minutesRoutes: Routes = [
    { path: '', loadComponent: () => import('./components/minutes-list/minutes-list').then(m => m.MinutesList) },
    { path: ':meetingId', loadComponent: () => import('./components/minutes-editor/minutes-editor').then(m => m.MinutesEditor) },
];

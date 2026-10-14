import { Routes } from '@angular/router';

/** P11 — Lịch họp. */
export const calendarRoutes: Routes = [
    { path: '', loadComponent: () => import('./components/calendar-home/calendar-home').then(m => m.CalendarHome) },
];

import { Routes } from '@angular/router';

/** P8 — Tổng quan. Plan: Document/Plan_P8_TongQuan.md */
export const dashboardRoutes: Routes = [
    { path: '', loadComponent: () => import('./components/dashboard/dashboard').then(m => m.Dashboard) },
];

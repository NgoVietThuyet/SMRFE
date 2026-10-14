import { Routes } from '@angular/router';

/** P12 — Công việc (giao diện theo module "Quản lý công việc" của 2.FrontEnd). Plan: Document/Plan_P12_CongViec.md */
export const taskRoutes: Routes = [
    { path: '', loadComponent: () => import('./components/task-home/task-home').then(m => m.TaskHome) },
    { path: ':workId', loadComponent: () => import('./components/task-board/task-board').then(m => m.TaskBoard) },
];

import { Routes } from '@angular/router';

/** Nhóm Quản trị (P1–P7) — chỉ Admin; AdminGuard gắn ở route cha 'admin' trong app.routes.ts. */
export const adminRoutes: Routes = [
    { path: '', redirectTo: 'organizations', pathMatch: 'full' },
    { path: 'organizations', loadComponent: () => import('./components/organizations/organizations').then(m => m.Organizations) },
    { path: 'titles', loadComponent: () => import('./components/titles/titles').then(m => m.Titles) },
    { path: 'accounts', loadComponent: () => import('./components/accounts/accounts').then(m => m.Accounts) },
    { path: 'permissions', loadComponent: () => import('./components/permissions/permissions').then(m => m.Permissions) },
    { path: 'dashboard', loadComponent: () => import('./components/dashboard/admin-dashboard').then(m => m.AdminDashboard) },
    { path: 'audit-logs', loadComponent: () => import('./components/audit-logs/audit-logs').then(m => m.AuditLogs) },
    { path: 'settings', loadComponent: () => import('./components/settings/settings').then(m => m.Settings) },
];

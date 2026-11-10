import { Routes } from '@angular/router';
import { PermissionGuard } from '../../core/guards';
import { APP_RIGHTS } from '../../shared/constants/right.constants';

/** Nhóm Quản trị (P1–P7) — mỗi trang cần đúng quyền menu tương ứng (Admin luôn vào được). */
export const adminRoutes: Routes = [
    { path: '', redirectTo: 'organizations', pathMatch: 'full' },
    { path: 'organizations', loadComponent: () => import('./components/organizations/organizations').then(m => m.Organizations), canActivate: [PermissionGuard], data: { requiredRight: APP_RIGHTS.ADMIN_ORGANIZATIONS } },
    { path: 'titles', loadComponent: () => import('./components/titles/titles').then(m => m.Titles), canActivate: [PermissionGuard], data: { requiredRight: APP_RIGHTS.ADMIN_TITLES } },
    { path: 'accounts', loadComponent: () => import('./components/accounts/accounts').then(m => m.Accounts), canActivate: [PermissionGuard], data: { requiredRight: APP_RIGHTS.ADMIN_ACCOUNTS } },
    { path: 'permissions', loadComponent: () => import('./components/permissions/permissions').then(m => m.Permissions), canActivate: [PermissionGuard], data: { requiredRight: APP_RIGHTS.ADMIN_PERMISSIONS } },
    { path: 'dashboard', loadComponent: () => import('./components/dashboard/admin-dashboard').then(m => m.AdminDashboard), canActivate: [PermissionGuard], data: { requiredRight: APP_RIGHTS.ADMIN_STATISTICS } },
    { path: 'audit-logs', loadComponent: () => import('./components/audit-logs/audit-logs').then(m => m.AuditLogs), canActivate: [PermissionGuard], data: { requiredRight: APP_RIGHTS.ADMIN_AUDIT_LOGS } },
    { path: 'settings', loadComponent: () => import('./components/settings/settings').then(m => m.Settings), canActivate: [PermissionGuard], data: { requiredRight: APP_RIGHTS.ADMIN_SETTINGS } },
];

import { Route, Routes } from '@angular/router';
import { AdminGuard, AuthGuard, UnauthGuard, roomGuard } from './core/guards';

/**
 * Mục menu chưa làm → trang "Đang phát triển". Phase làm xong mục nào thì thay bằng loadComponent/loadChildren thật.
 * Thứ tự và phạm vi: Document/SMR-Phase.md · Document/SMR-Scope.md.
 */
function underConstruction(path: string, title: string, phase: string): Route {
  return {
    path,
    loadComponent: () => import('./shared/layouts/under-construction/under-construction').then(m => m.UnderConstruction),
    data: { title, phase },
  };
}

export const routes: Routes = [
  // P10 — phòng họp toàn màn hình (ngoài Shell). Khai báo trước Shell để 'meetings/:id' không bắt mất.
  {
    path: 'meetings/:id/join',
    canActivate: [roomGuard],
    loadComponent: () => import('./features/meeting/components/room/meeting-room').then(m => m.MeetingRoom),
  },
  // Link mời: khách nhập tên / người đã đăng nhập được chuyển vào phòng.
  {
    path: 'join/:roomCode',
    loadComponent: () => import('./features/meeting/components/guest-join/guest-join').then(m => m.GuestJoin),
  },
  {
    path: '',
    loadComponent: () => import('./shared/layouts/main-layout/main-layout').then(m => m.MainLayout),
    canActivate: [AuthGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

      {
        path: 'dashboard',
        loadChildren: () => import('./features/dashboard/dashboard.routes').then(m => m.dashboardRoutes),
      },
      {
        path: 'meetings',
        loadChildren: () => import('./features/meeting/meeting.routes').then(m => m.meetingRoutes),
      },
      {
        path: 'calendar',
        loadChildren: () => import('./features/calendar/calendar.routes').then(m => m.calendarRoutes),
      },
      {
        path: 'tasks',
        loadChildren: () => import('./features/task/task.routes').then(m => m.taskRoutes),
      },
      {
        path: 'minutes',
        loadChildren: () => import('./features/minutes/minutes.routes').then(m => m.minutesRoutes),
      },
      {
        path: 'ai-assistant',
        loadChildren: () => import('./features/ai-assistant/ai-assistant.routes').then(m => m.aiAssistantRoutes),
      },
      {
        path: 'contacts',
        loadChildren: () => import('./features/contacts/contacts.routes').then(m => m.contactsRoutes),
      },

      {
        path: 'profile',
        loadComponent: () => import('./features/profile/components/profile').then(m => m.Profile),
      },

      {
        path: 'admin',
        canActivate: [AdminGuard],
        canActivateChild: [AdminGuard],
        loadChildren: () => import('./features/admin/admin.routes').then(m => m.adminRoutes),
      },
    ],
  },
  {
    path: '',
    loadComponent: () => import('./shared/layouts/blank-layout/blank-layout').then(m => m.BlankLayout),
    children: [
      { path: 'login', loadComponent: () => import('./features/authentication/components/login').then(m => m.Login), canActivate: [UnauthGuard] },
      { path: 'reset-password', loadComponent: () => import('./features/authentication/components/reset-password/reset-password').then(m => m.ResetPassword), canActivate: [UnauthGuard] },
      { path: 'not-permission', loadComponent: () => import('./shared/layouts/not-permission/not-permission').then(m => m.NotPermission), canActivate: [AuthGuard] },
      { path: 'error-server', loadComponent: () => import('./shared/layouts/error-server/error-server').then(m => m.ErrorServer) },
    ],
  },
  { path: '**', loadComponent: () => import('./shared/layouts/not-found/not-found').then(m => m.NotFound) },
];

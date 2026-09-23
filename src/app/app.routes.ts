import { Routes } from '@angular/router';
import { authGuard, loginGuard } from './core/guards/auth.guard';
import { Shell } from './layout/shell/shell';

export const routes: Routes = [
    // Màn hình xác thực — đứng ngoài Shell (không Sidebar/Header)
    {
        path: 'login',
        canActivate: [loginGuard],
        loadComponent: () => import('./pages/login/login').then((m) => m.Login),
    },
    // Phòng họp full-screen — ngoài Shell để tối đa không gian video
    {
        path: 'meetings/:id/join',
        canActivate: [authGuard],
        loadComponent: () =>
            import('./pages/meetings/room/meeting-room').then((m) => m.MeetingRoom),
    },
    {
        path: '',
        component: Shell,
        canActivate: [authGuard],
        children: [
            {
                path: '',
                redirectTo: 'dashboard',
                pathMatch: 'full',
            },
            {
                path: 'dashboard',
                loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
                data: {
                    showSearch: false,
                    breadcrumb: [{ label: 'Tổng quan' }],
                },
            },
            {
                path: 'meetings',
                loadComponent: () => import('./pages/meetings/meetings').then((m) => m.Meetings),
                data: {
                    showSearch: false,
                    breadcrumb: [{ label: 'Cuộc họp' }],
                },
            },
            {
                path: 'tasks',
                loadComponent: () => import('./pages/tasks/tasks').then((m) => m.Tasks),
                data: {
                    showSearch: false,
                    breadcrumb: [{ label: 'Công việc' }],
                },
            },
            {
                // Công việc trong ngữ cảnh cuộc họp — 1 component dùng chung, đặt trước :id
                path: 'meetings/:id/tasks',
                loadComponent: () => import('./pages/tasks/tasks').then((m) => m.Tasks),
                data: {
                    showSearch: false,
                    meetingContext: true,
                    breadcrumb: [
                        { label: 'Cuộc họp', route: '/meetings' },
                        { label: 'Công việc' },
                    ],
                },
            },
            {
                path: 'meetings/:id',
                loadComponent: () =>
                    import('./pages/meetings/detail/meeting-detail').then((m) => m.MeetingDetail),
                data: {
                    showBack: true,
                    showSearch: false,
                    breadcrumb: [{ label: 'Cuộc họp', route: '/meetings' }, { label: 'Chi tiết' }],
                },
            },
            {
                path: 'catalogs',
                data: {
                    showSearch: false,
                    breadcrumb: [{ label: 'Danh mục' }],
                },
                children: [
                    { path: '', redirectTo: 'contacts', pathMatch: 'full' },
                    {
                        path: 'contacts',
                        loadComponent: () => import('./pages/catalogs/contacts/contacts').then((m) => m.Contacts),
                        data: {
                            showSearch: false,
                            breadcrumb: [{ label: 'Danh mục', route: '/catalogs' }, { label: 'Danh bạ' }],
                        },
                    },
                    {
                        path: 'titles',
                        loadComponent: () => import('./pages/catalogs/titles/titles').then((m) => m.Titles),
                        data: {
                            showSearch: false,
                            breadcrumb: [{ label: 'Danh mục', route: '/catalogs' }, { label: 'Chức danh' }],
                        },
                    },
                ],
            },
            {
                path: 'contacts',
                redirectTo: 'catalogs/contacts',
                pathMatch: 'full',
            },
            {
                path: '**',
                redirectTo: 'dashboard',
            },
            // TODO: thêm các module khác theo đây
            // { path: 'documents', loadComponent: () => import('./pages/documents/documents').then(m => m.Documents) },
        ],
    },
];

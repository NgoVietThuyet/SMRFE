/**
 * Mã quyền — khớp đúng BE-Java service/ad/PermissionCatalog.java (12 mã).
 * Dùng cho route.data.requiredRight, directive [appPermission].
 * Admin (SUPER_ADMIN) luôn có mọi quyền nên không cần liệt kê.
 */
export const APP_RIGHTS = {
    // Có quyền này = toàn quyền như quản trị viên (thấy mọi menu, xem toàn bộ cuộc họp...).
    ADMIN: 'ADMIN',

    // Quyền vào từng menu Quản trị — Admin gán cho tài khoản / chức danh / phòng ban nào thì người đó thấy menu đó.
    ADMIN_ORGANIZATIONS: 'ADMIN_ORGANIZATIONS',
    ADMIN_TITLES: 'ADMIN_TITLES',
    ADMIN_ACCOUNTS: 'ADMIN_ACCOUNTS',
    ADMIN_PERMISSIONS: 'ADMIN_PERMISSIONS',
    ADMIN_STATISTICS: 'ADMIN_STATISTICS',
    ADMIN_AUDIT_LOGS: 'ADMIN_AUDIT_LOGS',
    ADMIN_SETTINGS: 'ADMIN_SETTINGS',

} as const;

export type AppRight = typeof APP_RIGHTS[keyof typeof APP_RIGHTS];

/** Mọi quyền vào menu Quản trị (có 1 trong các quyền này thì thấy nhóm menu Quản trị). */
export const ADMIN_MENU_RIGHTS: string[] = [
    APP_RIGHTS.ADMIN_ORGANIZATIONS, APP_RIGHTS.ADMIN_TITLES, APP_RIGHTS.ADMIN_ACCOUNTS, APP_RIGHTS.ADMIN_PERMISSIONS,
    APP_RIGHTS.ADMIN_STATISTICS, APP_RIGHTS.ADMIN_AUDIT_LOGS, APP_RIGHTS.ADMIN_SETTINGS,
];

import { MENU_PARENT_ROOT } from '../utils/const';

/**
 * Một mục menu — cùng cấu trúc phẳng với dữ liệu menu của 2.FrontEnd
 * nên TreeUtils.buildNzMenuTree() dựng cây được ngay.
 */
export interface AppMenuItem {
    id: string;
    pId: string;
    name: string;
    /** Không có url = nhóm cha (chỉ mở/đóng). */
    url?: string;
    /** Tên Bootstrap Icons, không kèm tiền tố `bi-`. */
    icon?: string;
    orderNumber: number;
    /** Chỉ hiện với Admin (SUPER_ADMIN). Đặt ở nhóm cha thì ẩn cả nhóm. */
    adminOnly?: boolean;
}

/**
 * Menu tĩnh của SMR (BE-Java không có API menu) — xem Document/SMR-Phase.md "Bản đồ menu và phase".
 * Mục chưa làm trỏ tới route UnderConstruction; phase nào xong thì route đó tự đổi sang trang thật.
 */
export const APP_MENU: AppMenuItem[] = [
    { id: 'DASH', pId: MENU_PARENT_ROOT, name: 'Tổng quan', url: '/dashboard', icon: 'speedometer2', orderNumber: 1 },

    { id: 'MEET', pId: MENU_PARENT_ROOT, name: 'Cuộc họp', icon: 'camera-video', orderNumber: 2 },
    { id: 'MEET_MY', pId: 'MEET', name: 'Cuộc họp của tôi', url: '/meetings', orderNumber: 1 },
    { id: 'MEET_CAL', pId: 'MEET', name: 'Lịch họp', url: '/calendar', orderNumber: 2 },

    { id: 'TASK', pId: MENU_PARENT_ROOT, name: 'Công việc', url: '/tasks', icon: 'kanban', orderNumber: 3 },
    { id: 'MINU', pId: MENU_PARENT_ROOT, name: 'Biên bản họp', url: '/minutes', icon: 'file-earmark-text', orderNumber: 4 },
    { id: 'AI', pId: MENU_PARENT_ROOT, name: 'Trợ lý AI', url: '/ai-assistant', icon: 'robot', orderNumber: 5 },
    { id: 'CONT', pId: MENU_PARENT_ROOT, name: 'Danh bạ', url: '/contacts', icon: 'person-lines-fill', orderNumber: 6 },

    { id: 'ADM', pId: MENU_PARENT_ROOT, name: 'Quản trị', icon: 'gear', orderNumber: 9, adminOnly: true },
    { id: 'ADM_ORG', pId: 'ADM', name: 'Cơ cấu tổ chức', url: '/admin/organizations', orderNumber: 1, adminOnly: true },
    { id: 'ADM_TTL', pId: 'ADM', name: 'Chức danh', url: '/admin/titles', orderNumber: 2, adminOnly: true },
    { id: 'ADM_ACC', pId: 'ADM', name: 'Tài khoản', url: '/admin/accounts', orderNumber: 3, adminOnly: true },
    { id: 'ADM_PER', pId: 'ADM', name: 'Phân quyền', url: '/admin/permissions', orderNumber: 4, adminOnly: true },
    { id: 'ADM_STA', pId: 'ADM', name: 'Thống kê', url: '/admin/dashboard', orderNumber: 5, adminOnly: true },
    { id: 'ADM_LOG', pId: 'ADM', name: 'Nhật ký hoạt động', url: '/admin/audit-logs', orderNumber: 6, adminOnly: true },
    { id: 'ADM_CFG', pId: 'ADM', name: 'Cấu hình hệ thống', url: '/admin/settings', orderNumber: 7, adminOnly: true },
];

/** Lọc menu theo vai trò: bỏ mục adminOnly và mục con của nhóm adminOnly khi không phải Admin. */
export function menuForRole(isAdmin: boolean): AppMenuItem[] {
    if (isAdmin) return [...APP_MENU];
    const hiddenParents = new Set(APP_MENU.filter(m => m.adminOnly).map(m => m.id));
    return APP_MENU.filter(m => !m.adminOnly && !hiddenParents.has(m.pId));
}

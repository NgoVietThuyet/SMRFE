import { MENU_PARENT_ROOT } from '../utils/const';
import { APP_RIGHTS } from './right.constants';

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
    /** Quyền cần có để thấy mục này (Admin luôn thấy). Nhóm cha không đặt: hiện khi còn ít nhất một mục con hiện. */
    right?: string;
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
    { id: 'MEET_ALL', pId: 'MEET', name: 'Toàn bộ cuộc họp', url: '/meetings/all', orderNumber: 3, right: APP_RIGHTS.ADMIN },

    { id: 'TASK', pId: MENU_PARENT_ROOT, name: 'Công việc', url: '/tasks', icon: 'kanban', orderNumber: 3 },
    { id: 'MINU', pId: MENU_PARENT_ROOT, name: 'Biên bản họp', url: '/minutes', icon: 'file-earmark-text', orderNumber: 4 },
    { id: 'AI', pId: MENU_PARENT_ROOT, name: 'Trợ lý AI', url: '/ai-assistant', icon: 'robot', orderNumber: 5 },

    { id: 'ADM', pId: MENU_PARENT_ROOT, name: 'Quản trị', icon: 'gear', orderNumber: 9 },
    { id: 'ADM_ORG', pId: 'ADM', name: 'Cơ cấu tổ chức', url: '/admin/organizations', orderNumber: 1, right: APP_RIGHTS.ADMIN_ORGANIZATIONS },
    { id: 'ADM_TTL', pId: 'ADM', name: 'Chức danh', url: '/admin/titles', orderNumber: 2, right: APP_RIGHTS.ADMIN_TITLES },
    { id: 'ADM_ACC', pId: 'ADM', name: 'Tài khoản', url: '/admin/accounts', orderNumber: 3, right: APP_RIGHTS.ADMIN_ACCOUNTS },
    { id: 'ADM_PER', pId: 'ADM', name: 'Phân quyền', url: '/admin/permissions', orderNumber: 4, right: APP_RIGHTS.ADMIN_PERMISSIONS },
    { id: 'ADM_STA', pId: 'ADM', name: 'Thống kê', url: '/admin/dashboard', orderNumber: 5, right: APP_RIGHTS.ADMIN_STATISTICS },
    { id: 'ADM_LOG', pId: 'ADM', name: 'Nhật ký hoạt động', url: '/admin/audit-logs', orderNumber: 6, right: APP_RIGHTS.ADMIN_AUDIT_LOGS },
    { id: 'ADM_CFG', pId: 'ADM', name: 'Cấu hình hệ thống', url: '/admin/settings', orderNumber: 7, right: APP_RIGHTS.ADMIN_SETTINGS },
];

/**
 * Lọc menu theo quyền: Admin thấy tất cả; người khác chỉ thấy mục không đòi quyền hoặc mục có quyền được gán.
 * Nhóm cha (Quản trị) tự ẩn khi không còn mục con nào hiện.
 */
export function menuForRole(isAdmin: boolean, rights: string[] = []): AppMenuItem[] {
    if (isAdmin) return [...APP_MENU];
    const granted = new Set(rights);
    const visible = APP_MENU.filter(m => !m.right || granted.has(m.right));
    const parentsWithChildren = new Set(visible.map(m => m.pId));
    // Nhóm cha (không có url) chỉ giữ khi còn mục con.
    return visible.filter(m => m.url || parentsWithChildren.has(m.id));
}

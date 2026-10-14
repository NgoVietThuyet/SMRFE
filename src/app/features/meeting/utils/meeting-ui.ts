import { DateTimeUtils } from '../../../shared/utils';
import { MeetingListItem, MeetingRole, MeetingStatus, MeetingVisibility } from '../models/meeting.models';

/** Nhãn + màu nz-tag cho trạng thái cuộc họp. */
export const MEETING_STATUS_META: Record<MeetingStatus, { label: string; color: string }> = {
    [MeetingStatus.Draft]: { label: 'Nháp', color: 'default' },
    [MeetingStatus.Scheduled]: { label: 'Sắp diễn ra', color: 'processing' },
    [MeetingStatus.Ongoing]: { label: 'Đang diễn ra', color: 'success' },
    [MeetingStatus.Ended]: { label: 'Đã kết thúc', color: 'default' },
    [MeetingStatus.Cancelled]: { label: 'Đã hủy', color: 'error' },
    [MeetingStatus.Archived]: { label: 'Đã lưu trữ', color: 'default' },
};

export const MEETING_ROLE_OPTIONS: { value: MeetingRole; label: string; color: string }[] = [
    { value: MeetingRole.Host, label: 'Chủ trì', color: 'gold' },
    { value: MeetingRole.CoHost, label: 'Đồng chủ trì', color: 'orange' },
    { value: MeetingRole.Secretary, label: 'Thư ký', color: 'blue' },
    { value: MeetingRole.Required, label: 'Bắt buộc', color: 'default' },
    { value: MeetingRole.Optional, label: 'Tùy chọn', color: 'default' },
];

/**
 * Vai trò gán được cho người tham gia. "Chủ trì" là người tạo cuộc họp, không gán cho người khác;
 * trao quyền quản lý (sửa, hủy, bắt đầu, thêm bớt thành viên, duyệt biên bản) thì chọn "Đồng chủ trì".
 */
export const MEETING_ASSIGNABLE_ROLES = MEETING_ROLE_OPTIONS.filter(r => r.value !== MeetingRole.Host);

export const MEETING_VISIBILITY_OPTIONS: { value: MeetingVisibility; label: string; hint: string }[] = [
    { value: MeetingVisibility.InvitedOnly, label: 'Chỉ người được mời', hint: 'Chỉ thành viên xem và vào được' },
    { value: MeetingVisibility.Internal, label: 'Nội bộ', hint: 'Người trong tổ chức có mã phòng' },
    { value: MeetingVisibility.Public, label: 'Công khai', hint: 'Ai có link đều xin vào được' },
];

/** Nhãn hoạt động trong MeetingAuditLogs.Action. */
export const MEETING_ACTIVITY_LABELS: Record<string, string> = {
    CREATE: 'Tạo cuộc họp',
    CREATE_QUICK: 'Tạo cuộc họp nhanh',
    UPDATE: 'Cập nhật thông tin',
    PUBLISH: 'Phát hành và gửi lời mời',
    CANCEL: 'Hủy cuộc họp',
    DELETE: 'Xóa cuộc họp',
    ARCHIVE: 'Lưu trữ',
    ADD_PARTICIPANTS: 'Thêm người tham gia',
    REMOVE_PARTICIPANT: 'Xóa người tham gia',
    START: 'Bắt đầu cuộc họp',
    END: 'Kết thúc cuộc họp',
    JOIN: 'Vào phòng',
    LEAVE: 'Rời phòng',
};

export function roleMeta(role: number): { label: string; color: string } {
    return MEETING_ROLE_OPTIONS.find(r => r.value === role) ?? { label: 'Thành viên', color: 'default' };
}

export function visibilityLabel(v: number): string {
    return MEETING_VISIBILITY_OPTIONS.find(o => o.value === v)?.label ?? '---';
}

/** Link mời dành cho người ngoài (màn /join/:roomCode làm ở P10). */
export function meetingJoinLink(roomCode: string): string {
    return new URL(`/join/${encodeURIComponent(roomCode)}`, window.location.origin).href;
}

/** Nội dung lời mời để dán vào chat/email. */
export function meetingInviteText(m: Pick<MeetingListItem, 'name' | 'expectedStartTime' | 'expectedEndTime' | 'roomCode'>): string {
    const start = DateTimeUtils.fromUtc(m.expectedStartTime);
    const end = DateTimeUtils.fromUtc(m.expectedEndTime);
    const pad = (n: number) => String(n).padStart(2, '0');
    const hm = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const when = start
        ? `${pad(start.getDate())}/${pad(start.getMonth() + 1)}/${start.getFullYear()} · ${hm(start)}${end ? ' – ' + hm(end) : ''}`
        : '';
    return `${m.name}\n${when}\nMã phòng: ${m.roomCode}\n${meetingJoinLink(m.roomCode)}`;
}

/**
 * Thao tác được phép theo trạng thái + vai trò (khớp kiểm tra ở MeetingServiceImpl).
 * isHost = chủ trì (BE chỉ cho chủ trì sửa/hủy/xóa/lưu trữ/bắt đầu).
 */
export const MeetingActions = {
    canJoin: (m: MeetingListItem) => m.status === MeetingStatus.Scheduled || m.status === MeetingStatus.Ongoing,
    canStart: (m: MeetingListItem) => m.isHost && m.status === MeetingStatus.Scheduled,
    canEdit: (m: MeetingListItem) => m.isHost && m.status <= MeetingStatus.Ongoing,
    // Bản nháp chưa mời ai → xóa thay vì hủy.
    canCancel: (m: MeetingListItem) => m.isHost && m.status === MeetingStatus.Scheduled,
    canArchive: (m: MeetingListItem) => m.isHost && (m.status === MeetingStatus.Ended || m.status === MeetingStatus.Cancelled),
    canDelete: (m: MeetingListItem) => m.isHost && m.status === MeetingStatus.Draft,
    canShare: (m: MeetingListItem) => m.status <= MeetingStatus.Ongoing && m.status !== MeetingStatus.Draft,
};

/** Sao chép văn bản, trả về Promise<boolean> để nơi gọi tự báo kết quả. */
export function copyText(text: string): Promise<boolean> {
    if (!navigator.clipboard) return Promise.resolve(false);
    return navigator.clipboard.writeText(text).then(() => true, () => false);
}

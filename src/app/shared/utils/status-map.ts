// =====================================================
// Nguồn DUY NHẤT cho nhãn + tông màu trạng thái (F-14).
// Tông màu ứng với class `.smr-status--{tone}` trong styles.
// =====================================================

export type StatusTone = 'upcoming' | 'ongoing' | 'ended' | 'cancelled' | 'pending' | 'draft' | 'success';

export interface StatusView {
    label: string;
    tone: StatusTone;
}

// MeetingStatus BE: Draft=0, Scheduled=1, Ongoing=2, Ended=3, Cancelled=4, Archived=5
const MEETING_STATUS: Record<number, StatusView> = {
    0: { label: 'Bản nháp', tone: 'pending' },
    1: { label: 'Sắp diễn ra', tone: 'upcoming' },
    2: { label: 'Đang diễn ra', tone: 'ongoing' },
    3: { label: 'Đã kết thúc', tone: 'ended' },
    4: { label: 'Đã hủy', tone: 'cancelled' },
    5: { label: 'Lưu trữ', tone: 'draft' },
};

// TaskStatus BE: NotStarted=0, InProgress=1, Completed=2
const TASK_STATUS: Record<number, StatusView> = {
    0: { label: 'Chưa bắt đầu', tone: 'draft' },
    1: { label: 'Đang thực hiện', tone: 'upcoming' },
    2: { label: 'Hoàn thành', tone: 'success' },
};

const UNKNOWN: StatusView = { label: 'Không xác định', tone: 'draft' };

export function meetingStatus(status: number | null | undefined): StatusView {
    return (status != null && MEETING_STATUS[status]) || UNKNOWN;
}

export function taskStatus(status: number | null | undefined): StatusView {
    return (status != null && TASK_STATUS[status]) || UNKNOWN;
}

import { HttpErrorResponse } from '@angular/common/http';

/**
 * Chuyển lỗi bất kỳ thành câu thông báo thân thiện cho người dùng (F-16).
 * - Giữ nguyên thông điệp nghiệp vụ do BE trả về (vd "Cuộc họp chưa bắt đầu").
 * - Ẩn thông điệp kỹ thuật của Angular HttpClient ("Http failure response for http://…: 500 …").
 */
export function friendlyError(err: unknown, fallback: string): string {
    if (err instanceof HttpErrorResponse) return byStatus(err.status, fallback);
    const message = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
    if (!message || isTechnical(message)) {
        const status = Number(/\b([45]\d\d)\b/.exec(message)?.[1] ?? 0);
        return byStatus(status, fallback);
    }
    return message;
}

function isTechnical(message: string): boolean {
    return /Http failure|https?:\/\/|ERR_|TypeError|Unknown Error|status of \d{3}/i.test(message);
}

function byStatus(status: number, fallback: string): string {
    if (status === 0) return 'Không kết nối được máy chủ. Vui lòng kiểm tra mạng và thử lại.';
    if (status === 401 || status === 403) return 'Bạn không có quyền xem nội dung này hoặc phiên đăng nhập đã hết hạn.';
    if (status === 404) return 'Không tìm thấy dữ liệu yêu cầu.';
    if (status >= 500) return `${fallback} Máy chủ đang gặp sự cố, vui lòng thử lại sau ít phút.`;
    return fallback;
}

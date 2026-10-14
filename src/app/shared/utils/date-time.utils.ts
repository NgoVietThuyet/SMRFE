/**
 * BE-Java lưu và trả mọi thời gian dạng LocalDateTime theo UTC, không kèm múi giờ
 * (FE gửi Date.toISOString(); BE dùng Clock.systemUTC()). Đọc/ghi luôn qua các hàm dưới đây.
 */
export class DateTimeUtils {
    /** Chuỗi LocalDateTime UTC từ BE → Date (giờ máy). Chuỗi đã có Z/offset thì giữ nguyên. */
    static fromUtc(value: string | null | undefined): Date | null {
        if (!value) return null;
        const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : value + 'Z');
        return isNaN(date.getTime()) ? null : date;
    }

    /** Date → chuỗi gửi lên BE (ISO UTC, có Z — Jackson đọc được vào LocalDateTime UTC). */
    static toUtc(date: Date): string {
        return date.toISOString();
    }

    static startOfDay(date: Date = new Date()): Date {
        const d = new Date(date);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    static endOfDay(date: Date = new Date()): Date {
        const d = new Date(date);
        d.setHours(23, 59, 59, 999);
        return d;
    }

    static isSameDay(a: Date, b: Date): boolean {
        return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    }

    /** Số ngày lịch giữa hai mốc (b - a), bỏ qua giờ. */
    static dayDiff(a: Date, b: Date): number {
        return Math.round((DateTimeUtils.startOfDay(b).getTime() - DateTimeUtils.startOfDay(a).getTime()) / 86_400_000);
    }
}

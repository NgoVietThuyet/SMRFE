import { Pipe, PipeTransform } from '@angular/core';
import { DateTimeUtils } from '../utils/date-time.utils';

const WEEKDAYS = ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/**
 * Thời gian tương đối tiếng Việt cho giờ BE (UTC).
 *   upcoming: "Sau 12 phút" · "Hôm nay 14:00" · "Ngày mai 08:30" · "Thứ Hai 13/10" · "Đã quá giờ"
 *   due:      "17:00 hôm nay" · "trễ 2 ngày" · "Ngày mai" · "13/10"
 * Truyền `now` (đổi mỗi phút) để pipe thuần vẫn tự cập nhật.
 */
@Pipe({ name: 'relativeTime', standalone: true })
export class RelativeTimePipe implements PipeTransform {
  transform(value: string | null | undefined, now: Date = new Date(), mode: 'upcoming' | 'due' = 'upcoming'): string {
    const date = DateTimeUtils.fromUtc(value);
    if (!date) return '';
    return mode === 'due' ? RelativeTimePipe.due(date, now) : RelativeTimePipe.upcoming(date, now);
  }

  static upcoming(date: Date, now: Date): string {
    const minutes = Math.round((date.getTime() - now.getTime()) / 60_000);
    const days = DateTimeUtils.dayDiff(now, date);
    const hhmm = RelativeTimePipe.hhmm(date);
    if (minutes < 0) return days < 0 ? `Quá giờ từ ${RelativeTimePipe.ddmm(date)}` : 'Đã quá giờ';
    if (minutes >= 0 && minutes < 60) return minutes <= 1 ? 'Sắp bắt đầu' : `Sau ${minutes} phút`;
    if (days === 0) return `Hôm nay ${hhmm}`;
    if (days === 1) return `Ngày mai ${hhmm}`;
    if (days > 1 && days < 7) return `${WEEKDAYS[date.getDay()]} ${RelativeTimePipe.ddmm(date)}`;
    return RelativeTimePipe.ddmm(date);
  }

  static due(date: Date, now: Date): string {
    const days = DateTimeUtils.dayDiff(now, date);
    if (days < 0) return `trễ ${-days} ngày`;
    if (days === 0) return date.getTime() < now.getTime() ? `trễ hạn ${RelativeTimePipe.hhmm(date)}` : `${RelativeTimePipe.hhmm(date)} hôm nay`;
    if (days === 1) return 'Ngày mai';
    return RelativeTimePipe.ddmm(date);
  }

  private static hhmm(date: Date): string {
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }

  private static ddmm(date: Date): string {
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  }
}

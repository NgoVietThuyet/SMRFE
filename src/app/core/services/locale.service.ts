import { Injectable, signal } from '@angular/core';

export type AppLocale = 'vi' | 'en';

const LOCALE_KEY = 'smr.locale';

// =====================================================
// LocaleService — chuyển đổi VI/EN, lưu localStorage.
// Hiện chỉ lưu lựa chọn + phát tín hiệu; khi có hạ tầng
// i18n (transloco/ngx-translate) thì đấu vào đây.
// =====================================================
@Injectable({ providedIn: 'root' })
export class LocaleService {
    private readonly saved = (localStorage.getItem(LOCALE_KEY) as AppLocale | null) ?? 'vi';
    readonly locale = signal<AppLocale>(this.saved === 'en' ? 'en' : 'vi');

    setLocale(value: AppLocale): void {
        this.locale.set(value);
        localStorage.setItem(LOCALE_KEY, value);
    }
}

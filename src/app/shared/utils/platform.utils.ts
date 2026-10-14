export class PlatformUtils {
    static isBrowser(): boolean {
        return typeof window !== 'undefined' && typeof document !== 'undefined';
    }

    static isServer(): boolean {
        return !PlatformUtils.isBrowser();
    }

    static isMobile(): boolean {
        if (!PlatformUtils.isBrowser()) return false;
        const ua = navigator.userAgent || navigator.vendor;
        return /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua.toLowerCase());
    }

    static isIOS(): boolean {
        if (!PlatformUtils.isBrowser()) return false;
        return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    }

    static isAndroid(): boolean {
        if (!PlatformUtils.isBrowser()) return false;
        return /android/i.test(navigator.userAgent);
    }

    static isTouchDevice(): boolean {
        return PlatformUtils.isBrowser() && 'ontouchstart' in window;
    }

    static getBrowserLocale(): string {
        if (!PlatformUtils.isBrowser()) return 'en-US';
        return navigator.language || (navigator as any).userLanguage || 'en-US';
    }

    static getBrowserTimezone(): string {
        try {
            return Intl.DateTimeFormat().resolvedOptions().timeZone;
        } catch {
            return 'UTC';
        }
    }
}

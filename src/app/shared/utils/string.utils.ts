export class StringUtils {
    static generateUUID(): string {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        // Fallback for non-secure contexts (HTTP)
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
            const r = (typeof crypto !== 'undefined' && crypto.getRandomValues)
                ? (crypto.getRandomValues(new Uint8Array(1))[0] & 15)
                : Math.floor(Math.random() * 16);
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    static decodeUnicodeEscapes(str: string): string {
        return str.replace(/\\u([a-fA-F0-9]{4})/g, (_, g1) =>
            String.fromCharCode(parseInt(g1, 16))
        );
    }

    static removeEmoji(text: string): string {
        this.decodeUnicodeEscapes(text);
        return text.replace(/([\uD800-\uDBFF][\uDC00-\uDFFF])/g, '');
    }

    /** Bỏ dấu tiếng Việt + chữ thường, dùng cho ô tìm kiếm (có dấu/không dấu đều khớp). */
    static normalizeSearch(value: string | null | undefined): string {
        return (value ?? '')
            .trim()
            .toLowerCase()
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/đ/g, 'd');
    }
}

import { DOCUMENT } from '@angular/common';
import { inject, provideAppInitializer } from '@angular/core';

/**
 * Vá tên truy cập cho các input nội bộ do ng-zorro sinh ra mà template không chạm tới được
 * (axe "label" — critical): ô chọn "số dòng/trang" của phân trang, input ẩn của nz-tree,
 * checkbox bọc trong <label nz-checkbox>. Chỉ thêm aria-label khi phần tử CHƯA có tên.
 */
const RULES: { selector: string; name: (el: HTMLElement) => string }[] = [
    { selector: '.ant-pagination-options-size-changer input', name: () => 'Số dòng mỗi trang' },
    { selector: 'nz-tree input', name: () => 'Cây tổ chức' },
    {
        selector: 'input.ant-checkbox-input',
        name: (el) => el.closest('label')?.textContent?.trim() || 'Chọn',
    },
    {
        // nz-select chưa có directive SelectA11y (component không import): lấy aria-label của host hoặc placeholder
        selector: 'nz-select input.ant-select-selection-search-input',
        name: (el) => {
            const host = el.closest('nz-select');
            return (
                host?.getAttribute('aria-label') ||
                host?.querySelector('.ant-select-selection-placeholder')?.textContent?.trim() ||
                host?.querySelector('.ant-select-selection-item')?.textContent?.trim() ||
                ''
            );
        },
    },
];

function hasName(el: HTMLElement): boolean {
    if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return true;
    const id = el.id;
    return !!id && !!el.ownerDocument.querySelector(`label[for="${CSS.escape(id)}"]`);
}

function patch(root: ParentNode): void {
    for (const rule of RULES) {
        root.querySelectorAll<HTMLElement>(rule.selector).forEach((el) => {
            if (hasName(el)) return;
            const name = rule.name(el);
            if (name) el.setAttribute('aria-label', name);
        });
    }
}

export function provideA11yPatch() {
    return provideAppInitializer(() => {
        const doc = inject(DOCUMENT);
        const view = doc.defaultView;
        if (!view || typeof MutationObserver === 'undefined') return;
        let scheduled = false;
        const run = () => {
            scheduled = false;
            patch(doc.body);
        };
        new MutationObserver(() => {
            if (scheduled) return;
            scheduled = true;
            view.requestAnimationFrame(run);
        }).observe(doc.body, { childList: true, subtree: true });
    });
}

import { afterNextRender, DestroyRef, Directive, ElementRef, inject } from '@angular/core';

/**
 * Gán tên truy cập (accessible name) cho ô input bên trong <nz-select>.
 * ng-zorro không chuyển aria-label / <label for> của host xuống input nội bộ
 * → axe báo lỗi "label" (critical) ở mọi ô lọc. Directive tự áp cho mọi nz-select
 * trong component có import nó. Thứ tự ưu tiên: aria-label của host → <label for=id>
 * → nzPlaceHolder đang hiển thị.
 */
@Directive({ selector: 'nz-select', standalone: true })
export class SelectA11yDirective {
    private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

    constructor() {
        const destroyRef = inject(DestroyRef);
        afterNextRender(() => {
            this.apply();
            const observer = new MutationObserver(() => this.apply());
            observer.observe(this.host, { childList: true, subtree: true });
            destroyRef.onDestroy(() => observer.disconnect());
        });
    }

    private apply(): void {
        const input = this.host.querySelector('input');
        if (!input) return;
        const name = this.resolveName();
        if (name && input.getAttribute('aria-label') !== name) input.setAttribute('aria-label', name);
    }

    private resolveName(): string {
        const own = this.host.getAttribute('aria-label');
        if (own) return own;
        const id = this.host.id;
        if (id) {
            const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
            const text = label?.textContent?.replace(/\*/g, '').trim();
            if (text) return text;
        }
        const placeholder = this.host.querySelector('.ant-select-selection-placeholder')?.textContent?.trim();
        return placeholder ?? '';
    }
}

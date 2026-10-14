import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';

/**
 * Một nút hành động trên header drawer/popup.
 * Danh sách truyền theo thứ tự trái → phải; nút `primary` (nếu có) luôn được đặt ở mép phải.
 */
export interface HeaderAction {
    label: string;
    /** Nhãn ngắn cho mobile (vd "Tạo cuộc họp" → "Tạo"). */
    mobileLabel?: string;
    /** primary: nút chính (tô màu) · default: nút thường. */
    kind?: 'primary' | 'default';
    danger?: boolean;
    icon?: string;
    loading?: boolean;
    disabled?: boolean;
    hidden?: boolean;
    /** Luôn nằm trong menu ⋯ (hành động phụ, hành động nguy hiểm trong drawer xem). */
    overflow?: boolean;
    /** id của <form> để nút submit form dù nằm ngoài thẻ form (thuộc tính HTML `form`). */
    submitForm?: string;
    /** Nhận focus khi popup mở (dùng cho nút "Không" ở popup xác nhận nguy hiểm). */
    autofocus?: boolean;
    run?: () => void;
}

// =====================================================
// HeaderActions — nhóm nút ở góc phải header drawer/popup
// (Plan_GiaoDien_Drawer.md §2). Quy tắc:
// - Thứ tự trái → phải: phụ → từ chối → ■ chính (mép phải).
// - Desktop: tối đa 3 nút hiện; `overflow` và phần dư vào ⋯.
// - < 768px: chỉ hiện nút chính, còn lại vào ⋯.
// - busy: khóa mọi nút trừ nút đang loading.
// - status: dòng trạng thái thay cho nút (vd "Đã lưu").
// =====================================================
@Component({
    selector: 'smr-header-actions',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [NzButtonModule, NzDropdownModule, NzIconModule],
    host: { class: 'smr-header-actions' },
    template: `
        @if (status()) {
            <span class="smr-header-actions__status" role="status">
                @if (statusBusy()) { <span class="smr-header-actions__spin" aria-hidden="true"></span> }
                @else { <span nz-icon nzType="check" nzTheme="outline" aria-hidden="true"></span> }
                {{ status() }}
            </span>
        }
        @for (a of secondary(); track a.label; let i = $index) {
            <button nz-button [nzType]="'default'" [nzDanger]="!!a.danger" class="smr-header-actions__btn"
                [class.is-extra]="i < secondary().length - maxSecondaryInline()"
                [attr.type]="a.submitForm ? 'submit' : 'button'" [attr.form]="a.submitForm || null"
                [attr.data-autofocus]="a.autofocus ? '' : null"
                [disabled]="isDisabled(a)" [nzLoading]="!!a.loading" (click)="a.run?.()">
                @if (a.icon) { <span nz-icon [nzType]="a.icon" nzTheme="outline"></span> }
                <span>{{ a.label }}</span>
            </button>
        }
        @if (menuItems().length) {
            <button type="button" nz-button nzType="default" class="smr-header-actions__more"
                [class.has-desktop-items]="hasDesktopMenu()" nz-dropdown [nzDropdownMenu]="menu" nzTrigger="click"
                nzPlacement="bottomRight" aria-label="Thêm hành động" [disabled]="busy()">
                <span nz-icon nzType="more" nzTheme="outline"></span>
            </button>
            <nz-dropdown-menu #menu="nzDropdownMenu">
                <ul nz-menu>
                    @for (m of menuItems(); track m.action.label) {
                        <li nz-menu-item [nzDanger]="!!m.action.danger" [nzDisabled]="isDisabled(m.action)"
                            [class.smr-header-actions__mobile-only]="m.mobileOnly" (click)="m.action.run?.()">
                            @if (m.action.icon) { <span nz-icon [nzType]="m.action.icon" nzTheme="outline"></span> }
                            {{ m.action.label }}
                        </li>
                    }
                </ul>
            </nz-dropdown-menu>
        }
        @if (primary(); as p) {
            <button nz-button nzType="primary" [nzDanger]="!!p.danger" class="smr-header-actions__primary"
                [attr.type]="p.submitForm ? 'submit' : 'button'" [attr.form]="p.submitForm || null"
                [attr.data-autofocus]="p.autofocus ? '' : null"
                [disabled]="isDisabled(p)" [nzLoading]="!!p.loading" (click)="p.run?.()">
                @if (p.icon) { <span nz-icon [nzType]="p.icon" nzTheme="outline"></span> }
                <span class="smr-header-actions__label">{{ p.label }}</span>
                <span class="smr-header-actions__label-short">{{ p.mobileLabel || p.label }}</span>
            </button>
        }
    `,
    styles: `
        :host { display: inline-flex; align-items: center; gap: 8px; flex-shrink: 0; }
        .smr-header-actions__status {
            display: inline-flex; align-items: center; gap: 6px; margin-right: 4px;
            font-size: 13px; color: var(--text-muted); white-space: nowrap;
        }
        .smr-header-actions__spin {
            width: 12px; height: 12px; border-radius: 50%;
            border: 2px solid var(--border-default); border-top-color: var(--primary-600);
            animation: smr-ha-spin 0.8s linear infinite;
        }
        @keyframes smr-ha-spin { to { transform: rotate(360deg); } }
        .smr-header-actions__btn.is-extra { display: none; }
        .smr-header-actions__more:not(.has-desktop-items) { display: none; }
        .smr-header-actions__label-short { display: none; }
        .smr-header-actions__mobile-only { display: none; }
        @media (max-width: 767px) {
            .smr-header-actions__btn { display: none; }
            .smr-header-actions__more { display: inline-flex !important; }
            .smr-header-actions__mobile-only { display: flex; }
            .smr-header-actions__label { display: none; }
            .smr-header-actions__label-short { display: inline; }
            .smr-header-actions__status { display: none; }
        }
        @media (prefers-reduced-motion: reduce) { .smr-header-actions__spin { animation-duration: 2.4s; } }
    `,
})
export class HeaderActions {
    readonly actions = input<HeaderAction[]>([]);
    /** Đang gửi: khóa mọi nút trừ nút đang loading. */
    readonly busy = input(false);
    readonly status = input<string | null>(null);
    readonly statusBusy = input(false);
    /** Số nút phụ tối đa hiện trên desktop (cộng nút chính = 3). */
    readonly maxSecondaryInline = input(2);

    private readonly visible = computed(() => this.actions().filter((a) => !a.hidden));
    protected readonly primary = computed(() => this.visible().find((a) => a.kind === 'primary') ?? null);
    protected readonly secondary = computed(() => this.visible().filter((a) => a.kind !== 'primary' && !a.overflow));

    /** Mục trong ⋯: luôn có các nút overflow; trên mobile thêm mọi nút phụ (+ phần dư trên desktop). */
    protected readonly menuItems = computed(() => {
        const sec = this.secondary();
        const extraCount = Math.max(0, sec.length - this.maxSecondaryInline());
        return [
            ...sec.map((action, i) => ({ action, mobileOnly: i >= extraCount })),
            ...this.visible().filter((a) => a.overflow).map((action) => ({ action, mobileOnly: false })),
        ];
    });
    protected readonly hasDesktopMenu = computed(() => this.menuItems().some((m) => !m.mobileOnly));

    protected isDisabled(a: HeaderAction): boolean {
        return !!a.disabled || (this.busy() && !a.loading);
    }
}

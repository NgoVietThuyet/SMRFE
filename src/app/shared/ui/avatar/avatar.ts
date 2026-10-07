import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Lấy 2 chữ cái đầu: "Lê Minh Cường" → "LC", "cuong.le" → "CL". */
export function initialsOf(name: string | null | undefined): string {
    const parts = (name ?? '').trim().split(/[\s._-]+/).filter(Boolean);
    if (!parts.length) return '?';
    const first = parts[0][0] ?? '';
    const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
    return (first + last).toUpperCase();
}

/** Chọn 1 trong 8 cặp màu (smr-avatar--0..7) cố định theo tên — cùng người luôn cùng màu. */
export function avatarTone(seed: string | null | undefined): number {
    let h = 0;
    for (const ch of seed ?? '') h = (h * 31 + ch.charCodeAt(0)) | 0;
    return Math.abs(h) % 8;
}

/**
 * <smr-avatar name="Lê Minh Cường" size="sm" />
 * Không bao giờ hiển thị hình tròn rỗng (F-11): luôn có initials hoặc '?'.
 */
@Component({
    selector: 'smr-avatar',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'smr-avatar',
        '[class]': "'smr-avatar smr-avatar--' + tone() + ' smr-avatar--size-' + size()",
        '[attr.title]': 'name() || null',
        '[attr.aria-label]': 'name() || null',
        role: 'img',
    },
    template: `{{ initials() }}`,
    styles: `
        :host.smr-avatar--size-xs { width: 20px; height: 20px; flex-basis: 20px; font-size: 9px; }
        :host.smr-avatar--size-sm { width: 28px; height: 28px; flex-basis: 28px; font-size: 11px; }
        :host.smr-avatar--size-md { width: 36px; height: 36px; flex-basis: 36px; font-size: 13px; }
        :host.smr-avatar--size-lg { width: 48px; height: 48px; flex-basis: 48px; font-size: 16px; }
    `,
})
export class Avatar {
    readonly name = input<string | null | undefined>('');
    readonly size = input<'xs' | 'sm' | 'md' | 'lg'>('sm');
    protected readonly initials = computed(() => initialsOf(this.name()));
    protected readonly tone = computed(() => avatarTone(this.name()));
}

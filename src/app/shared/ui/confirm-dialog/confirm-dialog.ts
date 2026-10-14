import { AfterViewInit, Component, computed, ElementRef, inject, Injectable, signal } from '@angular/core';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NZ_MODAL_DATA, NzModalRef, NzModalService } from 'ng-zorro-antd/modal';
import { HeaderAction, HeaderActions } from '../header-actions/header-actions';

export interface ConfirmOptions {
    title: string;
    content?: string;
    okText?: string;
    cancelText?: string;
    /** Hành động nguy hiểm: icon cảnh báo, nút chính đỏ. */
    danger?: boolean;
    /**
     * Việc cần làm khi đồng ý. Popup giữ mở + loading tới khi xong;
     * ném lỗi → popup vẫn mở để người dùng thử lại hoặc hủy (caller tự báo lỗi).
     */
    onOk?: () => Promise<unknown> | unknown;
}

// =====================================================
// ConfirmDialog — popup xác nhận theo quy chuẩn header-actions:
// tiêu đề trái, [Không] [■ Đồng ý] phải; không footer, không X.
// Esc / bấm nền = từ chối. Popup nguy hiểm focus sẵn vào "Không".
// =====================================================
@Component({
    selector: 'smr-confirm-dialog',
    imports: [HeaderActions, NzIconModule],
    template: `
        <div class="smr-popup__head">
            @if (data.danger) {
                <span class="smr-popup__icon is-danger" aria-hidden="true">
                    <span nz-icon nzType="exclamation-circle" nzTheme="outline"></span>
                </span>
            }
            <h2 class="smr-popup__title" [attr.title]="data.title">{{ data.title }}</h2>
            <smr-header-actions [actions]="actions()" [busy]="running()" />
        </div>
        @if (data.content) {
            <div class="smr-popup__body"><p class="smr-popup__text">{{ data.content }}</p></div>
        }
    `,
})
export class ConfirmDialog implements AfterViewInit {
    protected readonly data = inject<ConfirmOptions>(NZ_MODAL_DATA);
    private readonly ref: NzModalRef<ConfirmDialog, boolean> = inject(NzModalRef);
    private readonly host: ElementRef<HTMLElement> = inject(ElementRef);
    protected readonly running = signal(false);

    protected readonly actions = computed<HeaderAction[]>(() => [
        {
            label: this.data.cancelText ?? 'Không',
            autofocus: !!this.data.danger,
            run: () => this.ref.close(false),
        },
        {
            label: this.data.okText ?? 'Đồng ý',
            kind: 'primary',
            danger: this.data.danger,
            autofocus: !this.data.danger,
            loading: this.running(),
            run: () => void this.confirm(),
        },
    ]);

    ngAfterViewInit(): void {
        setTimeout(() => this.host.nativeElement.querySelector<HTMLElement>('[data-autofocus]')?.focus());
    }

    private async confirm(): Promise<void> {
        if (this.running()) return;
        if (!this.data.onOk) {
            this.ref.close(true);
            return;
        }
        this.running.set(true);
        this.ref.updateConfig({ nzMaskClosable: false, nzKeyboard: false });
        try {
            await this.data.onOk();
            this.ref.close(true);
        } catch {
            this.running.set(false);
            this.ref.updateConfig({ nzMaskClosable: true, nzKeyboard: true });
        }
    }
}

/** Mở popup xác nhận. Trả về true khi người dùng đồng ý (và onOk chạy xong). */
@Injectable({ providedIn: 'root' })
export class ConfirmDialogService {
    private readonly modal = inject(NzModalService);

    open(options: ConfirmOptions): Promise<boolean> {
        const ref = this.modal.create<ConfirmDialog, ConfirmOptions, boolean>({
            nzContent: ConfirmDialog,
            nzData: options,
            nzTitle: undefined,
            nzFooter: null,
            nzClosable: false,
            nzAutofocus: null,
            nzWidth: 440,
            nzCentered: true,
            nzWrapClassName: 'smr-popup smr-popup--confirm',
        });
        return new Promise((resolve) => {
            ref.afterClose.subscribe((result) => resolve(result === true));
        });
    }
}

/** Hỏi trước khi bỏ thay đổi chưa lưu. true = được phép đóng. */
export function confirmDiscard(dialog: ConfirmDialogService, dirty: boolean): Promise<boolean> {
    if (!dirty) return Promise.resolve(true);
    return dialog.open({
        title: 'Bỏ thay đổi chưa lưu?',
        content: 'Những gì bạn vừa nhập sẽ không được lưu.',
        okText: 'Bỏ thay đổi',
        cancelText: 'Tiếp tục sửa',
        danger: true,
    });
}

/** Lưu khi form chưa hợp lệ: cuộn tới và focus trường lỗi đầu tiên. */
export function focusFirstInvalid(root: ParentNode | null | undefined): void {
    if (!root) return;
    setTimeout(() => {
        const field = root.querySelector<HTMLElement>(
            'input.ng-invalid, textarea.ng-invalid, nz-select.ng-invalid, nz-date-picker.ng-invalid, .ng-invalid input, .ng-invalid textarea'
        );
        if (!field) return;
        field.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
        const focusable = field.matches('input, textarea') ? field : field.querySelector<HTMLElement>('input, textarea');
        (focusable ?? field).focus?.();
    });
}

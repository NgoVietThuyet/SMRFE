import { TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CheckOutline, ExclamationCircleOutline, MoreOutline } from '@ant-design/icons-angular/icons';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzModalService } from 'ng-zorro-antd/modal';
import { ConfirmDialogService, confirmDiscard } from './confirm-dialog';

describe('ConfirmDialogService', () => {
    let service: ConfirmDialogService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [NoopAnimationsModule],
            providers: [NzModalService, provideNzIcons([CheckOutline, ExclamationCircleOutline, MoreOutline])],
        });
        service = TestBed.inject(ConfirmDialogService);
    });

    afterEach(() => document.querySelectorAll('.cdk-overlay-container').forEach((c) => (c.innerHTML = '')));

    async function flush(): Promise<void> {
        TestBed.tick();
        await new Promise((r) => setTimeout(r, 20));
        TestBed.tick();
    }

    function button(text: string): HTMLButtonElement {
        const btn = [...document.querySelectorAll<HTMLButtonElement>('.smr-popup button')].find((b) =>
            b.textContent?.includes(text)
        );
        if (!btn) throw new Error('Không thấy nút ' + text);
        return btn;
    }

    it('nút ở header: [Không] [■ Xóa], không có footer', async () => {
        void service.open({ title: 'Xóa việc nhỏ?', content: 'Không thể hoàn tác.', okText: 'Xóa', danger: true });
        await flush();
        const head = document.querySelector('.smr-popup .smr-popup__head') as HTMLElement;
        expect(head.textContent).toContain('Xóa việc nhỏ?');
        const names = [...head.querySelectorAll('button')].map((b) => b.textContent?.trim());
        expect(names[0]).toBe('Không');
        expect(names[names.length - 1]).toContain('Xóa');
        expect(document.querySelector('.smr-popup .ant-modal-footer button')).toBeNull();
    });

    it('Đồng ý chạy onOk rồi trả về true; Không trả về false', async () => {
        let ran = 0;
        const ok = service.open({ title: 'A', onOk: async () => void ran++ });
        await flush();
        button('Đồng ý').click();
        expect(await ok).toBe(true);
        expect(ran).toBe(1);

        const no = service.open({ title: 'B' });
        await flush();
        button('Không').click();
        expect(await no).toBe(false);
    });

    it('onOk lỗi thì popup vẫn mở để thử lại', async () => {
        let settled = false;
        void service.open({ title: 'C', onOk: () => Promise.reject(new Error('x')) }).then(() => (settled = true));
        await flush();
        button('Đồng ý').click();
        await flush();
        expect(settled).toBe(false);
        expect(document.querySelector('.smr-popup .smr-popup__head')).not.toBeNull();
    });

    it('confirmDiscard: form chưa sửa thì đóng ngay, không hỏi', async () => {
        expect(await confirmDiscard(service, false)).toBe(true);
        expect(document.querySelector('.smr-popup')).toBeNull();
    });
});

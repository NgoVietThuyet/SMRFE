import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { CheckOutline, DeleteOutline, EditOutline, MoreOutline } from '@ant-design/icons-angular/icons';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { HeaderAction, HeaderActions } from './header-actions';

describe('HeaderActions', () => {
    let fixture: ComponentFixture<HeaderActions>;
    let ran: string[];

    beforeEach(async () => {
        ran = [];
        await TestBed.configureTestingModule({
            imports: [HeaderActions, NoopAnimationsModule],
            providers: [provideNzIcons([CheckOutline, DeleteOutline, EditOutline, MoreOutline])],
        }).compileComponents();
        fixture = TestBed.createComponent(HeaderActions);
    });

    function set(actions: HeaderAction[], busy = false): HTMLElement {
        fixture.componentRef.setInput('actions', actions);
        fixture.componentRef.setInput('busy', busy);
        fixture.detectChanges();
        return fixture.nativeElement;
    }

    function labels(el: HTMLElement): string[] {
        return [...el.querySelectorAll('button')].map((b) => b.textContent?.trim() ?? '');
    }

    it('nút chính luôn ở mép phải dù khai báo ở đâu', () => {
        const el = set([
            { label: 'Lưu', kind: 'primary', run: () => ran.push('save') },
            { label: 'Hủy', run: () => ran.push('cancel') },
        ]);
        const names = labels(el).map((l) => l.replace(/\s+/g, ' '));
        expect(names[0]).toBe('Hủy');
        expect(names[names.length - 1]).toContain('Lưu');
        (el.querySelector('.smr-header-actions__primary') as HTMLButtonElement).click();
        expect(ran).toEqual(['save']);
    });

    it('nút overflow vào menu ⋯; nút hidden không hiện', () => {
        const el = set([
            { label: 'Xóa', danger: true, overflow: true },
            { label: 'Ẩn', hidden: true },
            { label: 'Sửa', kind: 'primary' },
        ]);
        expect(el.querySelector('.smr-header-actions__more.has-desktop-items')).not.toBeNull();
        expect(labels(el).some((l) => l.includes('Xóa'))).toBe(false);
        expect(labels(el).some((l) => l.includes('Ẩn'))).toBe(false);
    });

    it('busy khóa mọi nút trừ nút đang loading', () => {
        const el = set([{ label: 'Hủy' }, { label: 'Lưu', kind: 'primary', loading: true }], true);
        const cancel = el.querySelector('.smr-header-actions__btn') as HTMLButtonElement;
        expect(cancel.disabled).toBe(true);
    });

    it('nút submit form ngoài thẻ <form> dùng thuộc tính form', () => {
        const el = set([{ label: 'Lưu', kind: 'primary', submitForm: 'emp-form' }]);
        const btn = el.querySelector('.smr-header-actions__primary') as HTMLButtonElement;
        expect(btn.getAttribute('form')).toBe('emp-form');
        expect(btn.getAttribute('type')).toBe('submit');
    });

    it('hiện dòng trạng thái thay cho nút Lưu', () => {
        fixture.componentRef.setInput('status', 'Đã lưu');
        const el = set([]);
        expect(el.querySelector('.smr-header-actions__status')?.textContent).toContain('Đã lưu');
    });
});

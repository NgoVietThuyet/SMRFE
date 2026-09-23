import { provideNzI18n, en_US } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import {
    EyeInvisibleOutline,
    EyeOutline,
} from '@ant-design/icons-angular/icons';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { AuthUser } from '../../core/models/auth.models';
import { Login } from './login';

describe('Login', () => {
    let fixture: ComponentFixture<Login>;
    let component: Login;
    let login$: Subject<AuthUser>;
    let navigatedTo: unknown[][];

    beforeEach(async () => {
        login$ = new Subject<AuthUser>();
        navigatedTo = [];

        await TestBed.configureTestingModule({
            imports: [Login, NoopAnimationsModule],
            providers: [
                provideNzI18n(en_US),
                provideNzIcons([EyeOutline, EyeInvisibleOutline]),
                { provide: AuthService, useValue: { login: () => login$.asObservable() } },
                { provide: Router, useValue: { navigate: (...args: unknown[]) => { navigatedTo.push(args); } } },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(Login);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render brand, title and notice without register links', () => {
        const text = fixture.nativeElement.textContent as string;
        expect(text).toContain('SmartMeeting');
        expect(text).toContain('Đăng nhập hệ thống');
        expect(text).toContain('Đăng nhập bằng Google');
        expect(text).not.toContain('Đăng ký');
        expect(text).not.toContain('Facebook');
    });

    it('should show required validation on empty submit', () => {
        fixture.debugElement.query(By.css('button[type="submit"]')).nativeElement.click();
        fixture.detectChanges();

        const text = fixture.nativeElement.textContent as string;
        expect(text).toContain('Vui lòng nhập email.');
        expect(text).toContain('Vui lòng nhập mật khẩu.');
        expect(component.loading()).toBe(false);
    });

    it('should show email format error', () => {
        component.form.setValue({ email: 'not-an-email', password: 'secret' });
        component.emailCtrl.markAsTouched();
        fixture.detectChanges();

        expect(fixture.nativeElement.textContent).toContain('Email không đúng định dạng.');
    });

    it('should disable submit while loading and navigate on success', () => {
        component.form.setValue({ email: 'user@company.vn', password: 'secret' });
        fixture.detectChanges();

        const submitBtn = fixture.debugElement.query(
            By.css('button[type="submit"]')
        ).nativeElement as HTMLButtonElement;
        submitBtn.click();
        fixture.detectChanges();

        expect(component.loading()).toBe(true);
        expect(submitBtn.disabled).toBe(true);
        expect(submitBtn.textContent).toContain('Đang đăng nhập...');

        login$.next({ userName: 'user', fullName: 'User', email: 'user@company.vn' });

        expect(navigatedTo).toEqual([[['/']]]);
        expect(component.authError()).toBeNull();
    });

    it('should show generic auth error on login failure', () => {
        component.form.setValue({ email: 'user@company.vn', password: 'wrong' });
        fixture.detectChanges();

        fixture.debugElement.query(By.css('button[type="submit"]')).nativeElement.click();
        fixture.detectChanges();
        expect(component.loading()).toBe(true);

        login$.error(new Error('Tài khoản không tồn tại.'));
        fixture.detectChanges();

        expect(component.loading()).toBe(false);
        expect(component.form.enabled).toBe(true);
        // 1.15: thông báo chung, không tiết lộ email có tồn tại hay không
        expect(fixture.nativeElement.textContent).toContain(
            'Email hoặc mật khẩu không chính xác.'
        );
    });

    it('should toggle password visibility via built-in eye icon', () => {
        const getType = () =>
            (fixture.debugElement.query(By.css('#login-password')).nativeElement as HTMLInputElement)
                .type;

        expect(getType()).toBe('password');
        fixture.debugElement.query(By.css('.ant-input-password-icon')).nativeElement.click();
        fixture.detectChanges();
        expect(getType()).toBe('text');
        expect(component.showPassword()).toBe(true);
    });

    it('should report google login as not connected', () => {
        fixture.debugElement.query(By.css('.login__btn--google')).nativeElement.click();
        fixture.detectChanges();

        expect(fixture.nativeElement.textContent).toContain(
            'Đăng nhập bằng Google chưa được kết nối.'
        );
    });

    it('should render forgot password button', () => {
        expect(fixture.nativeElement.textContent).toContain('Quên mật khẩu?');
    });
});

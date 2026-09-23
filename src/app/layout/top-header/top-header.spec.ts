import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { Location } from '@angular/common';
import { signal } from '@angular/core';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import {
    ArrowLeftOutline,
    BellOutline,
    LogoutOutline,
    MenuFoldOutline,
    MenuUnfoldOutline,
    QuestionCircleOutline,
    SearchOutline,
} from '@ant-design/icons-angular/icons';
import { of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { TopHeader } from './top-header';

describe('TopHeader', () => {
    let fixture: ComponentFixture<TopHeader>;
    let component: TopHeader;
    let navigatedTo: unknown[][];
    let backCalls: number;

    beforeEach(async () => {
        navigatedTo = [];
        backCalls = 0;
        localStorage.removeItem('smr.locale');

        await TestBed.configureTestingModule({
            imports: [TopHeader, NoopAnimationsModule],
            providers: [
                provideRouter([]),
                provideNzI18n(en_US),
                provideNzIcons([
                    ArrowLeftOutline,
                    BellOutline,
                    LogoutOutline,
                    MenuFoldOutline,
                    MenuUnfoldOutline,
                    QuestionCircleOutline,
                    SearchOutline,
                ]),
                {
                    provide: AuthService,
                    useValue: {
                        currentUser: signal({
                            userName: 'nguyenvana',
                            fullName: 'Nguyễn Văn A',
                            email: 'a@company.vn',
                        }),
                        logout: () => of(undefined),
                    },
                },
                { provide: Location, useValue: { back: () => { backCalls++; } } },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(TopHeader);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should render breadcrumb with current page last', () => {
        fixture.componentRef.setInput('breadcrumb', [
            { label: 'Cuộc họp', route: '/meetings' },
            { label: 'Chi tiết' },
        ]);
        fixture.detectChanges();

        const text = fixture.nativeElement.textContent as string;
        expect(text).toContain('Cuộc họp');
        expect(text).toContain('Chi tiết');
        expect(
            fixture.debugElement.query(By.css('.smr-top-header__crumb-current'))?.nativeElement
                .textContent
        ).toContain('Chi tiết');
    });

    it('should emit collapseChange on toggle', () => {
        let emitted: boolean | undefined;
        component.collapseChange.subscribe((v) => (emitted = v));

        fixture.debugElement.query(By.css('.smr-top-header__left .smr-icon-btn')).nativeElement.click();

        expect(emitted).toBe(true);
    });

    it('should hide back by default and go back when shown', () => {
        expect(fixture.debugElement.query(By.css('[aria-label="Quay lại"]'))).toBeNull();

        fixture.componentRef.setInput('showBack', true);
        fixture.detectChanges();

        fixture.debugElement.query(By.css('[aria-label="Quay lại"]')).nativeElement.click();
        expect(backCalls).toBe(1);
    });

    it('should emit search text and hide search when disabled', () => {
        let query = '';
        component.searchChange.subscribe((v) => (query = v));

        const input = fixture.debugElement.query(
            By.css('.smr-top-header__search input')
        ).nativeElement as HTMLInputElement;
        input.value = 'họp sprint';
        input.dispatchEvent(new Event('input'));
        expect(query).toBe('họp sprint');

        fixture.componentRef.setInput('showSearch', false);
        fixture.detectChanges();
        expect(fixture.debugElement.query(By.css('.smr-top-header__search'))).toBeNull();
    });

    it('should switch locale VI/EN and persist', () => {
        const buttons = fixture.debugElement.queryAll(By.css('.smr-top-header__locale button'));
        expect(component.locale()).toBe('vi');

        buttons[1].nativeElement.click();
        fixture.detectChanges();

        expect(component.locale()).toBe('en');
        expect(localStorage.getItem('smr.locale')).toBe('en');
    });

    it('should show user initials and logout to login', () => {
        expect(fixture.nativeElement.textContent).toContain('NA');

        const router = TestBed.inject(Router);
        router.navigate = ((...args: unknown[]) => {
            navigatedTo.push(args);
            return Promise.resolve(true);
        }) as typeof router.navigate;
        component.logout();

        expect(navigatedTo).toEqual([[['/login']]]);
    });
});

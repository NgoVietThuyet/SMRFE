import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter, Router } from '@angular/router';
import { Location } from '@angular/common';
import { computed, signal } from '@angular/core';
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
    UserOutline,
} from '@ant-design/icons-angular/icons';
import { of } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { NotificationStore } from '../../core/services/notification.store';
import { TopHeader } from './top-header';

describe('TopHeader', () => {
    let fixture: ComponentFixture<TopHeader>;
    let component: TopHeader;
    let navigatedTo: unknown[][];
    const unread = signal(0);

    beforeEach(async () => {
        navigatedTo = [];
        unread.set(0);
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
                    UserOutline,
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
                { provide: Location, useValue: { subscribe: () => ({ unsubscribe: () => undefined }) } },
                {
                    provide: NotificationStore,
                    useValue: {
                        unreadCount: unread,
                        badge: computed(() => (unread() > 99 ? '99+' : unread() > 0 ? String(unread()) : '')),
                        lastArrived: signal(null),
                        // phần panel cần khi mở
                        items: signal([]),
                        filter: signal('all'),
                        loaded: signal(true),
                        loading: signal(false),
                        loadingMore: signal(false),
                        error: signal(null),
                        realtime: signal('connected'),
                        stale: signal(new Set()),
                        hasMore: signal(false),
                        load: () => Promise.resolve(),
                    },
                },
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

    it('should not render a back button', () => {
        expect(fixture.debugElement.query(By.css('[aria-label="Quay lại"]'))).toBeNull();
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

    it('should show unread badge and accessible bell label', () => {
        const bell = () => fixture.debugElement.query(By.css('.smr-top-header__bell')).nativeElement as HTMLButtonElement;
        expect(fixture.debugElement.query(By.css('.smr-top-header__badge'))).toBeNull();
        expect(bell().getAttribute('aria-label')).toBe('Thông báo');

        unread.set(3);
        fixture.detectChanges();
        expect(fixture.debugElement.query(By.css('.smr-top-header__badge')).nativeElement.textContent.trim()).toBe('3');
        expect(bell().getAttribute('aria-label')).toBe('Thông báo, 3 chưa đọc');

        unread.set(150);
        fixture.detectChanges();
        expect(fixture.debugElement.query(By.css('.smr-top-header__badge')).nativeElement.textContent.trim()).toBe('99+');
    });

    it('should toggle the notification panel from the bell', () => {
        const bell = fixture.debugElement.query(By.css('.smr-top-header__bell')).nativeElement as HTMLButtonElement;
        expect(bell.getAttribute('aria-expanded')).toBe('false');
        component.toggleNotifications();
        fixture.detectChanges();
        expect(component.panelOpen()).toBe(true);
        expect(bell.getAttribute('aria-expanded')).toBe('true');
        component.toggleNotifications();
        expect(component.panelOpen()).toBe(false);
    });
});

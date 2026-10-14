import { Component, computed, effect, ElementRef, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { NzPopoverModule } from 'ng-zorro-antd/popover';
import { NotificationSeverity } from '../../core/models/notification.models';
import { AuthService } from '../../core/services/auth.service';
import { AppLocale, LocaleService } from '../../core/services/locale.service';
import { NotificationStore } from '../../core/services/notification.store';
import { NotificationPanel } from '../notification-panel/notification-panel';
import { Avatar } from '../../shared/ui/avatar/avatar';

export interface BreadcrumbItem {
    label: string;
    route?: string;
}

// =====================================================
// TopHeader — SmartMeeting
// Toggle sidebar | Breadcrumb/Context
// | Global Search (conditional) | bell + VI/EN + help? + avatar
// Chuông: badge số chưa đọc; bấm mở panel thông báo (popover
// desktop, drawer toàn màn hình < 768px).
// =====================================================
@Component({
    selector: 'app-top-header',
    templateUrl: './top-header.html',
    host: { '(document:pointerdown)': 'onDocumentPointerDown($event)' },
    styleUrl: './top-header.scss',
    imports: [
        Avatar,
        NotificationPanel,
        RouterLink,
        NzDrawerModule,
        NzDropdownModule,
        NzIconModule,
        NzInputModule,
        NzMenuModule,
        NzPopoverModule,
    ],
})
export class TopHeader {
    private readonly auth = inject(AuthService);
    private readonly router = inject(Router);
    readonly localeService = inject(LocaleService);
    readonly notifications = inject(NotificationStore);
    private readonly notify = inject(NzNotificationService);

    readonly panelOpen = signal(false);
    readonly panelMobile = signal(false);
    readonly liveMessage = signal('');
    private readonly bellButton = viewChild<ElementRef<HTMLButtonElement>>('bell');

    readonly bellLabel = computed(() => {
        const n = this.notifications.unreadCount();
        return n > 0 ? `Thông báo, ${n} chưa đọc` : 'Thông báo';
    });

    collapsed = input<boolean>(false);
    collapseChange = output<boolean>();

    showSearch = input<boolean>(true);
    showHelp = input<boolean>(false);
    breadcrumb = input<BreadcrumbItem[]>([]);
    searchPlaceholder = input<string>('Tìm kiếm...');

    searchChange = output<string>();

    readonly user = this.auth.currentUser;
    readonly locale = this.localeService.locale;

    readonly initials = computed(() => {
        const name = (this.user()?.fullName ?? '').trim();
        if (!name) return 'NV';
        const parts = name.split(/\s+/);
        const first = parts[0]?.[0] ?? '';
        const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '';
        return (first + last).toUpperCase() || 'NV';
    });

    constructor() {
        // Thông báo realtime mới: đọc cho screen reader; mức cảnh báo trở lên thì hiện toast
        // (trừ khi panel đang mở — người dùng đã thấy trong danh sách).
        effect(() => {
            const n = this.notifications.lastArrived();
            if (!n) return;
            untracked(() => {
                this.liveMessage.set(`Thông báo mới: ${n.title}`);
                if (!this.panelOpen() && n.severity >= NotificationSeverity.Warning) {
                    this.notify.warning(n.title, n.body ?? '', { nzDuration: 5000, nzPlacement: 'topRight' });
                }
            });
        });
    }

    toggleNotifications(): void {
        if (this.panelOpen()) {
            this.closeNotifications();
            return;
        }
        this.panelMobile.set(window.matchMedia?.('(max-width: 767px)').matches ?? false);
        this.panelOpen.set(true);
    }

    closeNotifications(): void {
        this.panelOpen.set(false);
        // Trả focus về chuông (a11y)
        setTimeout(() => this.bellButton()?.nativeElement.focus());
    }

    /** Popover dùng trigger thủ công (để mobile mở drawer) nên tự đóng khi bấm ra ngoài. */
    onDocumentPointerDown(event: PointerEvent): void {
        if (!this.panelOpen() || this.panelMobile()) return;
        const target = event.target as HTMLElement | null;
        if (!target) return;
        const inside =
            this.bellButton()?.nativeElement.contains(target) ||
            target.closest('.smr-noti-popover') ||
            // menu "⋯" của từng thông báo và toast render ở overlay riêng
            target.closest('.ant-dropdown') ||
            target.closest('.ant-notification');
        if (!inside) this.panelOpen.set(false);
    }

    onPopoverVisible(visible: boolean): void {
        if (!visible && this.panelOpen()) this.panelOpen.set(false);
    }

    toggleSidebar(): void {
        this.collapseChange.emit(!this.collapsed());
    }

    onSearch(value: string): void {
        this.searchChange.emit(value);
    }

    setLocale(value: AppLocale): void {
        this.localeService.setLocale(value);
    }

    logout(): void {
        this.auth.logout().subscribe({
            next: () => void this.router.navigate(['/login']),
            error: () => void this.router.navigate(['/login']),
        });
    }
}

import { Location } from '@angular/common';
import { Component, computed, inject, input, output } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { AuthService } from '../../core/services/auth.service';
import { AppLocale, LocaleService } from '../../core/services/locale.service';

export interface BreadcrumbItem {
    label: string;
    route?: string;
}

// =====================================================
// TopHeader — SmartMeeting
// Toggle sidebar | Back (conditional) | Breadcrumb/Context
// | Global Search (conditional) | bell + VI/EN + help? + avatar
// =====================================================
@Component({
    selector: 'app-top-header',
    templateUrl: './top-header.html',
    styleUrl: './top-header.scss',
    imports: [RouterLink, NzDropdownModule, NzIconModule, NzInputModule, NzMenuModule],
})
export class TopHeader {
    private readonly auth = inject(AuthService);
    private readonly location = inject(Location);
    private readonly router = inject(Router);
    readonly localeService = inject(LocaleService);

    collapsed = input<boolean>(false);
    collapseChange = output<boolean>();

    showBack = input<boolean>(false);
    showSearch = input<boolean>(true);
    showHelp = input<boolean>(false);
    hasUnread = input<boolean>(false);
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

    toggleSidebar(): void {
        this.collapseChange.emit(!this.collapsed());
    }

    goBack(): void {
        this.location.back();
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

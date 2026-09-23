import { Component, input, inject, signal, computed, output } from '@angular/core';
import { Router, NavigationEnd, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

export interface NavItem {
  label: string;
  icon: string;
  route?: string;
  badge?: number;
  children?: NavItem[];
}

@Component({
  selector: 'app-sidebar',
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  imports: [CommonModule, RouterLink, RouterLinkActive, NzIconModule, NzTooltipModule, NzBadgeModule],
})
export class Sidebar {
  collapsed = input<boolean>(false);
  mobileOpen = input<boolean>(false);
  navigate = output<void>();
  private readonly router = inject(Router);

  readonly displayCollapsed = computed(() => this.collapsed() && !this.mobileOpen());

  expandedCatalogs = signal<boolean>(true);

  readonly mainNav: NavItem[] = [
    { label: 'Tổng quan', icon: 'dashboard', route: '/dashboard' },
    { label: 'Cuộc họp', icon: 'calendar', route: '/meetings' },
    { label: 'Công việc', icon: 'check-square', route: '/tasks' },
  ];

  readonly bottomNav: NavItem[] = [
    {
      label: 'Danh mục',
      icon: 'appstore',
      route: '/catalogs',
      children: [
        { label: 'Danh bạ', icon: 'team', route: '/catalogs/contacts' },
        { label: 'Chức danh', icon: 'apartment', route: '/catalogs/titles' },
      ],
    },
  ];

  isCatalogActive = computed(() => this.router.url.startsWith('/catalogs') || this.router.url.startsWith('/contacts'));

  constructor() {
    // Tự mở dropdown khi đang ở trong catalogs
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => {
        if (this.router.url.startsWith('/catalogs') || this.router.url.startsWith('/contacts')) {
          this.expandedCatalogs.set(true);
        }
      });
    if (this.router.url.startsWith('/catalogs') || this.router.url.startsWith('/contacts')) {
      this.expandedCatalogs.set(true);
    }
  }

  toggleCatalogs(): void {
    this.expandedCatalogs.update((v) => !v);
  }
}

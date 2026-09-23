import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { Sidebar } from '../sidebar/sidebar';
import { BreadcrumbItem, TopHeader } from '../top-header/top-header';

// Label fallback cho breadcrumb khi route không khai data.breadcrumb
const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Tổng quan',
  meetings: 'Cuộc họp',
  tasks: 'Công việc',
  whiteboard: 'Bảng trắng',
  records: 'Bản ghi',
  catalogs: 'Danh mục',
  contacts: 'Danh bạ',
  titles: 'Chức danh',
  settings: 'Cài đặt',
};

@Component({
  selector: 'app-shell',
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  imports: [RouterOutlet, Sidebar, TopHeader],
})
export class Shell {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  collapsed = signal<boolean>(false);
  mobileOpen = signal<boolean>(false);

  private syncSiderWidth(): void {
    const w = this.collapsed() ? '64px' : '240px';
    document.documentElement.style.setProperty('--app-sider-width', w);
    document.documentElement.style.setProperty('--sidebar-width', w);
  }

  private setScrollbarWidthVar(): void {
    try {
      const outer = document.createElement('div');
      outer.style.visibility = 'hidden';
      outer.style.overflow = 'scroll';
      outer.style.width = '100px';
      outer.style.height = '100px';
      outer.style.position = 'absolute';
      outer.style.top = '-9999px';
      document.body.appendChild(outer);
      const inner = document.createElement('div');
      inner.style.width = '100%';
      outer.appendChild(inner);
      const w = outer.offsetWidth - inner.offsetWidth;
      document.body.removeChild(outer);
      const sbW = w > 0 ? `${w}px` : '8px';
      // macOS overlay 0 -> fallback 8
      if (w === 0) {
        document.documentElement.style.setProperty('--sb-w', '8px');
      } else {
        document.documentElement.style.setProperty('--sb-w', sbW);
      }
    } catch {
      // noop
    }
  }

  // Conditional header — route con ghi đè qua data
  // { showBack, showSearch, showHelp, breadcrumb }
  showBack = signal<boolean>(false);
  showSearch = signal<boolean>(true);
  showHelp = signal<boolean>(false);
  breadcrumb = signal<BreadcrumbItem[]>([]);

  constructor() {
    // legacy: sync sider width + scrollbar width
    this.syncSiderWidth();
    this.setScrollbarWidthVar();
    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed()
      )
      .subscribe(() => this.syncFromRoute());
  }

  onCollapseChange(value: boolean): void {
    if (window.matchMedia('(max-width: 767px)').matches) {
      this.mobileOpen.update((open) => !open);
      return;
    }
    this.collapsed.set(value);
    this.syncSiderWidth();
  }

  closeMobileNavigation(): void {
    this.mobileOpen.set(false);
  }

  onSearchChange(_query: string): void {
    // TODO: xử lý global search (điều hướng trang tìm kiếm).
  }

  private syncFromRoute(): void {
    this.closeMobileNavigation();
    let deepest = this.route.snapshot;
    while (deepest.firstChild) deepest = deepest.firstChild;
    const data = deepest.data;

    this.showBack.set(data['showBack'] ?? false);
    this.showSearch.set(data['showSearch'] ?? true);
    this.showHelp.set(data['showHelp'] ?? false);
    this.breadcrumb.set((data['breadcrumb'] as BreadcrumbItem[] | undefined) ?? this.fromUrl());
  }

  private fromUrl(): BreadcrumbItem[] {
    const segs = this.router.url.split('?')[0].split('/').filter(Boolean);
    let acc = '';
    return segs.map((seg) => {
      acc += `/${seg}`;
      return { label: ROUTE_LABELS[seg] ?? seg, route: acc };
    });
  }
}

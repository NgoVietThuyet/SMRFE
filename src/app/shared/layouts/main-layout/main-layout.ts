import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, finalize, takeUntil } from 'rxjs/operators';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { SharedModules } from '../../ng-zorro.module';
import { AccountInfo, GlobalService, SessionService, TokenService } from '../../../core';
import { StringUtils, TreeUtils } from '../../utils';
import { MENU_PARENT_ROOT } from '../../utils/const';
import { menuForRole } from '../../constants';
import { AuthService, NotificationService, RealtimeHubService } from '../../services';
import { NotificationItem } from '../../models';

interface ChangePasswordModel {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

const SIDEBAR_COLLAPSED_KEY = 'sidebarCollapsed';
const NOTIFICATION_PAGE_SIZE = 20;

@Component({
  selector: 'app-main-layout',
  imports: [SharedModules],
  standalone: true,
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss'
})
export class MainLayout implements OnInit, OnDestroy {
  isCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  searchMenu = '';
  menuTree: any[] = [];
  displayedMenuTree: any[] = [];
  /** URL menu leaf khớp route hiện tại (bỏ query/hash). */
  private activeMenuUrl: string | null = null;
  accountInfo: AccountInfo | null = null;
  MENU_PARENT_ROOT = MENU_PARENT_ROOT;

  notifications: NotificationItem[] = [];
  unreadNotificationCount = 0;
  isNotificationPopoverVisible = false;
  private notificationCursor: string | null = null;
  notificationHasMoreData = true;
  isLoadingMoreNotifications = false;

  isVisibleChangePass = false;
  /** Bắt buộc đổi mật khẩu (MustChangePassword) → modal không cho đóng. */
  forceChangePassword = false;
  isChangingPassword = false;
  modelChangePass: ChangePasswordModel = { currentPassword: '', newPassword: '', confirmNewPassword: '' };

  private lastCheckedToken = 0;
  private readonly CHECK_INTERVAL = 60 * 1000;
  private readonly destroy$ = new Subject<void>();

  constructor(
    private global: GlobalService,
    private session: SessionService,
    private tokenService: TokenService,
    private authService: AuthService,
    private notificationService: NotificationService,
    private hub: RealtimeHubService,
    private notification: NzNotificationService,
    private router: Router,
  ) {
    this.accountInfo = this.session.accountInfo;
  }

  ngOnInit(): void {
    this.buildMenu();
    this.global.accountInfoUpdated$
      .pipe(takeUntil(this.destroy$))
      .subscribe((info: AccountInfo) => {
        const roleChanged = info?.isAdmin !== this.accountInfo?.isAdmin;
        this.accountInfo = info;
        if (roleChanged) this.buildMenu();
      });
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe((event: NavigationEnd) => this.refreshActiveMenuState(event.urlAfterRedirects));

    this.initNotifications();
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    if (this.accountInfo?.mustChangePassword) {
      this.forceChangePassword = true;
      this.changePassOpen();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
  }

  // ───────────────────────────── Menu ─────────────────────────────

  private buildMenu(): void {
    this.menuTree = TreeUtils.buildNzMenuTree(menuForRole(!!this.accountInfo?.isAdmin));
    this.displayedMenuTree = [...this.menuTree];
    this.onSearchChangeMenu();
    this.refreshActiveMenuState();
  }

  isMenuItemActive(menu: any): boolean {
    return !!menu?.url && menu.url === this.activeMenuUrl;
  }

  private refreshActiveMenuState(url?: string): void {
    const path = this.getRoutePath(url ?? this.router.url);
    this.activeMenuUrl = this.findActiveMenuUrl(this.menuTree, path);
    this.syncActiveRouteMenu(this.menuTree, path);
    this.syncActiveRouteMenu(this.displayedMenuTree, path);
    this.menuTree = [...this.menuTree];
    this.displayedMenuTree = [...this.displayedMenuTree];
  }

  private getRoutePath(url: string): string {
    return url.split('?')[0].split('#')[0];
  }

  /** Chọn menu leaf khớp nhất (URL dài nhất) để tránh highlight nhiều mục cùng prefix. */
  private findActiveMenuUrl(menuTree: any[], currentPath: string): string | null {
    let best: string | null = null;
    const visit = (nodes: any[]) => {
      for (const node of nodes) {
        if (node.url && this.menuUrlMatches(node.url, currentPath)) {
          if (!best || node.url.length > best.length) {
            best = node.url;
          }
        }
        if (node.children?.length) {
          visit(node.children);
        }
      }
    };
    visit(menuTree);
    return best;
  }

  private syncActiveRouteMenu(menuTree: any[], url?: string): void {
    const currentPath = url ? this.getRoutePath(url) : this.getRoutePath(this.router.url);
    const expandPath = (nodes: any[]): boolean => {
      for (const node of nodes) {
        if (node.url && this.menuUrlMatches(node.url, currentPath)) {
          return true;
        }
        if (node.children?.length && expandPath(node.children)) {
          node.open = true;
          return true;
        }
      }
      return false;
    };
    expandPath(menuTree);
  }

  private menuUrlMatches(menuUrl: string, currentPath: string): boolean {
    if (!menuUrl || menuUrl.startsWith('#')) {
      return false;
    }
    if (currentPath === menuUrl) {
      return true;
    }
    return menuUrl !== '/' && currentPath.startsWith(`${menuUrl}/`);
  }

  toggleSidebar(): void {
    this.isCollapsed = !this.isCollapsed;
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, this.isCollapsed ? '1' : '0');
  }

  get sidebarCollapsed(): boolean {
    return this.isCollapsed;
  }

  get userDropdownPlacement(): 'topCenter' | 'bottomRight' {
    return this.sidebarCollapsed ? 'bottomRight' : 'topCenter';
  }

  get displayFullName(): string {
    return this.accountInfo?.fullName || this.accountInfo?.userName || 'Người dùng';
  }

  get displaySubtitle(): string {
    if (this.accountInfo?.isAdmin) return 'Quản trị viên';
    return this.accountInfo?.titleName || this.accountInfo?.email || '';
  }

  get userAvatarText(): string {
    return this.global.getInitialsAvatar(this.displayFullName);
  }

  get userAvatarColor(): string {
    return this.global.getAvatarColor(this.accountInfo?.userName || this.displayFullName);
  }

  onOpenChange(changedMenu: any, isOpen: boolean): void {
    this.updateMenuOpenState(this.menuTree, changedMenu.key, changedMenu.level, isOpen);
    this.updateMenuOpenState(this.displayedMenuTree, changedMenu.key, changedMenu.level, isOpen);
    this.menuTree = [...this.menuTree];
    this.displayedMenuTree = [...this.displayedMenuTree];
  }

  onSearchChangeMenu(): void {
    const keyword = StringUtils.normalizeSearch(this.searchMenu);
    this.displayedMenuTree = keyword
      ? this.filterMenuTree(this.menuTree, keyword)
      : [...this.menuTree];
    this.syncActiveRouteMenu(this.displayedMenuTree);
    this.displayedMenuTree = [...this.displayedMenuTree];
  }

  /** Tìm có dấu hoặc không dấu đều khớp. Nhóm cha có mục con khớp thì tự mở. */
  private filterMenuTree(menuTree: any[], keyword: string): any[] {
    return menuTree.reduce((result: any[], node) => {
      const childrenMatched = node.children
        ? this.filterMenuTree(node.children, keyword)
        : [];
      const nameMatched = StringUtils.normalizeSearch(node.name).includes(keyword);

      if (nameMatched || childrenMatched.length > 0) {
        result.push({
          ...node,
          children: childrenMatched.length > 0 ? childrenMatched : node.children || null,
          open: childrenMatched.length > 0 || node.open
        });
      }
      return result;
    }, []);
  }

  private updateMenuOpenState(menuTree: any[], key: string, level: number, isOpen: boolean): void {
    menuTree.forEach(node => {
      if (level === 1 && node.level === 1) {
        node.open = node.key === key ? isOpen : false;
      } else if (node.key === key) {
        node.open = isOpen;
      }

      if (node.children?.length) {
        this.updateMenuOpenState(node.children, key, level, isOpen);
      }
    });
  }

  navigateRoute(route: string): void {
    this.router.navigate([route]);
  }

  // ─────────────────────────── Thông báo ───────────────────────────

  private initNotifications(): void {
    this.loadUnreadCount();
    void this.hub.start();

    this.hub.notificationCreated
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        const item = event?.notification;
        if (item && !this.notifications.some(n => n.id === item.id)) {
          this.notifications = [item, ...this.notifications];
        }
        this.unreadNotificationCount = Math.max(0, event?.unreadCount ?? this.unreadNotificationCount + 1);
      });

    this.hub.notificationsRead
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        const ids = event?.ids ? new Set(event.ids) : null;
        if (event?.deleted) {
          this.notifications = ids ? this.notifications.filter(n => !ids.has(n.id)) : [];
        } else {
          this.notifications = this.notifications.map(n =>
            !ids || ids.has(n.id) ? { ...n, isRead: event.isRead } : n);
        }
        if (typeof event?.unreadCount === 'number') {
          this.unreadNotificationCount = Math.max(0, event.unreadCount);
        }
      });
  }

  loadUnreadCount(): void {
    this.notificationService.unreadCount()
      .pipe(takeUntil(this.destroy$))
      .subscribe(count => this.unreadNotificationCount = count);
  }

  loadNotifications(isAppend: boolean = false): void {
    if (this.isLoadingMoreNotifications) return;
    if (!isAppend) {
      this.notificationCursor = null;
      this.notificationHasMoreData = true;
    }

    this.isLoadingMoreNotifications = true;
    this.notificationService.list('all', this.notificationCursor, NOTIFICATION_PAGE_SIZE)
      .pipe(
        takeUntil(this.destroy$),
        finalize(() => this.isLoadingMoreNotifications = false)
      )
      .subscribe(page => {
        const items = page?.items ?? [];
        this.notifications = isAppend ? [...this.notifications, ...items] : items;
        this.notificationCursor = page?.nextCursor ?? null;
        this.notificationHasMoreData = !!page?.nextCursor;
        if (typeof page?.unreadCount === 'number') {
          this.unreadNotificationCount = page.unreadCount;
        }
      });
  }

  openNotifications(): void {
    this.isNotificationPopoverVisible = true;
    this.loadNotifications(false);
  }

  closeNotificationPopover(event?: Event): void {
    if (event) {
      event.stopPropagation();
      event.preventDefault();
    }
    this.isNotificationPopoverVisible = false;
  }

  onNotificationPopoverVisibleChange(visible: boolean): void {
    this.isNotificationPopoverVisible = visible;
    if (visible) {
      this.loadNotifications(false);
    }
  }

  onNotificationClick(noti: NotificationItem): void {
    if (!noti.isRead) {
      this.notificationService.markRead(noti.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe(count => {
          noti.isRead = true;
          this.unreadNotificationCount = count;
        });
    }
    this.isNotificationPopoverVisible = false;
    const url = this.notificationUrl(noti);
    if (url) {
      this.router.navigateByUrl(url);
    }
  }

  removeNotification(noti: NotificationItem, event: Event): void {
    event.stopPropagation();
    this.notificationService.remove(noti.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.notifications = this.notifications.filter(n => n.id !== noti.id);
        if (!noti.isRead) {
          this.unreadNotificationCount = Math.max(0, this.unreadNotificationCount - 1);
        }
      });
  }

  markAllNotificationsAsRead(): void {
    const before = this.notifications[0]?.createDate ?? null;
    this.notificationService.readAll(before)
      .pipe(takeUntil(this.destroy$))
      .subscribe(count => {
        this.notifications = this.notifications.map(n => ({ ...n, isRead: true }));
        this.unreadNotificationCount = count;
      });
  }

  onNotificationScroll(event: Event): void {
    const el = event.target as HTMLElement;
    if (el.scrollHeight - (el.scrollTop + el.clientHeight) < 50
      && !this.isLoadingMoreNotifications && this.notificationHasMoreData) {
      this.loadNotifications(true);
    }
  }

  /** Điều hướng theo resourceType/resourceId. Trang đích của cuộc họp/công việc làm ở P9/P12. */
  private notificationUrl(noti: NotificationItem): string | null {
    if (noti.type?.startsWith('MINUTES_') && noti.resourceId) {
      return `/minutes/${encodeURIComponent(noti.resourceId)}`;
    }
    if (noti.resourceType === 'meeting' && noti.resourceId) {
      return `/meetings/${encodeURIComponent(noti.resourceId)}`;
    }
    if (noti.resourceType === 'task') {
      const workId = noti.data?.['workId'] || noti.resourceId;
      return workId ? `/tasks/${encodeURIComponent(workId)}` : '/tasks';
    }
    return null;
  }

  getNotificationIcon(type: string): string {
    if (type?.startsWith('MEETING_')) return 'video-camera';
    if (type?.startsWith('MINUTES_')) return 'file-text';
    if (type === 'TASK_COMPLETED') return 'check-circle';
    if (type?.startsWith('TASK_')) return 'carry-out';
    return 'bell';
  }

  // ───────────────────────── Đổi mật khẩu ─────────────────────────

  changePassOpen(): void {
    this.resetModelChangePass();
    this.isVisibleChangePass = true;
  }

  changePassOk(): void {
    const { currentPassword, newPassword, confirmNewPassword } = this.modelChangePass;

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      this.notification.error('Lỗi', 'Vui lòng nhập đầy đủ thông tin!');
      return;
    }
    if (newPassword.length < 8) {
      this.notification.error('Lỗi', 'Mật khẩu mới phải có ít nhất 8 ký tự!');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      this.notification.error('Lỗi', 'Mật khẩu xác nhận không giống với mật khẩu mới!');
      return;
    }

    this.isChangingPassword = true;
    this.authService.changePassword({ currentPassword, newPassword })
      .pipe(finalize(() => this.isChangingPassword = false))
      .subscribe({
        next: () => {
          this.isVisibleChangePass = false;
          this.session.setMustChangePassword(false);
          // BE tăng TokenVersion khi đổi mật khẩu → phiên hiện tại hết hiệu lực, phải đăng nhập lại.
          this.startLogoutCountdown();
        }
      });
  }

  changePassCancel(): void {
    if (this.forceChangePassword) return;
    this.resetModelChangePass();
    this.isVisibleChangePass = false;
  }

  private resetModelChangePass(): void {
    this.modelChangePass = { currentPassword: '', newPassword: '', confirmNewPassword: '' };
  }

  private startLogoutCountdown(): void {
    let countdown = 3;
    const notiKey = 'countdown';

    const updateNotification = () => {
      this.notification.success(
        'Đổi mật khẩu thành công!',
        `Vui lòng đăng nhập lại sau ${countdown}s.`,
        { nzKey: notiKey, nzDuration: 0 }
      );
    };

    updateNotification();
    const timer = setInterval(() => {
      countdown--;
      updateNotification();
      if (countdown === 0) {
        clearInterval(timer);
        this.notification.remove(notiKey);
        this.clearSessionAndGoLogin();
      }
    }, 1000);
  }

  // ─────────────────────────── Phiên ───────────────────────────

  logOut(): void {
    this.tokenService.logout().subscribe(() => this.clearSessionAndGoLogin());
  }

  private clearSessionAndGoLogin(): void {
    void this.hub.stop();
    this.session.clear();
    this.tokenService.clear();
    this.router.navigate(['/login']);
  }

  @HostListener('document:mousemove')
  @HostListener('document:keydown')
  onUserInteraction(): void {
    const now = Date.now();
    if (now - this.lastCheckedToken > this.CHECK_INTERVAL) {
      this.lastCheckedToken = now;
      this.checkToken();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.isNotificationPopoverVisible) return;
    const target = event.target as HTMLElement;
    if (
      target.closest('.notification-popover') ||
      target.closest('.user-profile-trigger') ||
      target.closest('.sidebar-user-dropdown')
    ) {
      return;
    }
    this.isNotificationPopoverVisible = false;
  }

  private handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      this.checkToken();
    }
  };

  /** Access token hết hạn khi đang mở trang → lấy lại bằng refresh token, thất bại thì về đăng nhập. */
  private checkToken(): void {
    if (this.tokenService.hasValidAccessToken()) return;
    this.tokenService.ensureSession().subscribe((ok) => {
      if (!ok) {
        this.clearSessionAndGoLogin();
      }
    });
  }
}


import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Observable, Subject, finalize, takeUntil } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzFormatEmitEvent, NzTreeNodeOptions } from 'ng-zorro-antd/tree';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { AuthService } from '../../../../shared/services';
import { FaceCapture } from '../../../../shared/components/face-capture/face-capture';
import { GlobalService, SessionService } from '../../../../core';
import { PaginationResult } from '../../../../shared/models';
import { AccountService } from '../../services/account.service';
import { OrganizationService } from '../../services/organization.service';
import { TitleService } from '../../services/title.service';
import { Employee, EmployeeDto, EmployeeFilter, OrganizationNode, OwnedMeeting, Title } from '../../models/admin.models';

type ActionKind = 'transfer' | 'title' | 'lock' | 'unlock';

/** P3 — Tài khoản (mẫu 2.FrontEnd system-manager/account): cây phòng ban để lọc + bảng tài khoản phân trang server. */
@Component({
  selector: 'app-accounts',
  standalone: true,
  imports: [SharedModules, FaceCapture],
  templateUrl: './accounts.html',
  styleUrl: './accounts.scss'
})
export class Accounts implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private auth = inject(AuthService);

  filter: EmployeeFilter = new EmployeeFilter();
  data: PaginationResult = new PaginationResult();
  organizations: OrganizationNode[] = [];
  orgTree: NzTreeNodeOptions[] = [];
  activeOrgTree: NzTreeNodeOptions[] = [];
  titles: Title[] = [];
  currentUser = '';

  // Drawer thêm/sửa
  visible = false;
  isEdit = false;
  isSaving = false;
  dto: EmployeeDto = new EmployeeDto();

  // Modal thao tác (điều chuyển / đổi chức danh / khóa-mở)
  actionVisible = false;
  actionKind: ActionKind = 'transfer';
  actionTarget: Employee | null = null;
  actionValue = '';
  actionReason = '';
  isActing = false;

  // Modal mật khẩu tạm (chỉ hiện một lần)
  passwordVisible = false;
  passwordUser = '';
  temporaryPassword = '';

  // ===== Quét mặt cho tài khoản vừa tạo (bước đăng ký) =====
  faceVisible = false;
  faceScanning = false;
  faceBusy = false;
  faceConsent = false;
  faceError = '';
  faceUser = '';
  private pendingPassword = '';

  constructor(
    private global: GlobalService,
    private session: SessionService,
    private service: AccountService,
    private orgService: OrganizationService,
    private titleService: TitleService,
    private message: NzMessageService,
  ) {
    this.global.setBreadcrumb([{ name: 'Tài khoản', path: 'admin/accounts' }]);
  }

  ngOnInit(): void {
    this.currentUser = this.session.accountInfo?.userName ?? '';
    this.orgService.tree(false).pipe(takeUntil(this.destroy$)).subscribe(list => {
      this.organizations = list ?? [];
      this.orgTree = OrganizationService.toNzTree(this.organizations, { expandAll: true });
      this.activeOrgTree = OrganizationService.toNzTree(this.organizations, { expandAll: true, selectableInactive: false });
    });
    this.titleService.list(false).pipe(takeUntil(this.destroy$)).subscribe(list => this.titles = list ?? []);
    this.search();
  }

  get activeTitles(): Title[] {
    return this.titles.filter(t => t.isActive);
  }

  search(): void {
    this.service.search(this.filter)
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => this.data = res);
  }

  searchFirstPage(): void {
    this.filter.page = 1;
    this.search();
  }

  onKeydownSearch(event: KeyboardEvent): void {
    if (event.isComposing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      this.searchFirstPage();
    }
  }

  onOrgClick(event: NzFormatEmitEvent): void {
    const key = event.node?.key ?? null;
    this.filter.organizationId = this.filter.organizationId === key ? null : key;
    this.searchFirstPage();
  }

  clearOrg(): void {
    this.filter.organizationId = null;
    this.searchFirstPage();
  }

  get selectedOrgName(): string {
    return this.organizations.find(o => o.id === this.filter.organizationId)?.name ?? 'Tất cả phòng ban';
  }

  reset(): void {
    this.filter = new EmployeeFilter();
    this.search();
  }

  pageIndexChange(page: number): void {
    this.filter.page = page;
    this.search();
  }

  pageSizeChange(size: number): void {
    this.filter.pageSize = size;
    this.filter.page = 1;
    this.search();
  }

  trackByUser(_: number, item: Employee): string {
    return item.userName;
  }

  isAdmin(item: Employee): boolean {
    return AccountService.isAdmin(item);
  }

  /** BE lưu LocalDateTime UTC → hiển thị theo giờ máy. */
  utc(value: string | null): Date | null {
    return value ? new Date(/[zZ]$/.test(value) ? value : value + 'Z') : null;
  }

  // ───────────────────────── Drawer ─────────────────────────

  open(item: Employee | null): void {
    this.isEdit = !!item;
    this.dto = item
      ? {
        userName: item.userName, fullName: item.fullName, email: item.email, phone: item.phone ?? '',
        address: item.address ?? '', organizationId: item.orgId, titleCode: item.titleCode,
      }
      : { ...new EmployeeDto(), organizationId: this.filter.organizationId ?? '' };
    this.visible = true;
  }

  close(): void {
    this.visible = false;
  }

  save(): void {
    const d = this.dto;
    if (!d.userName?.trim() || !d.fullName?.trim() || !d.email?.trim() || !d.organizationId || !d.titleCode) {
      this.message.warning('Vui lòng nhập đủ các trường bắt buộc (*)');
      return;
    }
    const body: EmployeeDto = { ...d, userName: d.userName.trim(), fullName: d.fullName.trim(), email: d.email.trim() };
    this.isSaving = true;

    if (this.isEdit) {
      this.service.update(body.userName, body)
        .pipe(finalize(() => this.isSaving = false), takeUntil(this.destroy$))
        .subscribe(() => this.afterSave('Đã cập nhật tài khoản'));
      return;
    }

    const create$: Observable<{ userName: string; temporaryPassword: string }> =
      this.service.create(body);
    create$
      .pipe(finalize(() => this.isSaving = false), takeUntil(this.destroy$))
      .subscribe(res => {
        this.afterSave('Đã tạo tài khoản');
        this.offerFace(res.userName, res.temporaryPassword);
      });
  }

  /** Bước đăng ký: nếu hệ thống bật khuôn mặt thì mời quét mặt cho người dùng (có thể bỏ qua), rồi mới hiện mật khẩu tạm. */
  private offerFace(userName: string, password: string): void {
    this.auth.faceStatus().pipe(takeUntil(this.destroy$)).subscribe({
      next: s => {
        if (!s.enabled) { this.showPassword(userName, password); return; }
        this.faceUser = userName;
        this.pendingPassword = password;
        this.faceConsent = false;
        this.faceError = '';
        this.faceScanning = false;
        this.faceBusy = false;
        this.faceVisible = true;
      },
      error: () => this.showPassword(userName, password),
    });
  }

  startFaceScan(): void {
    this.faceError = '';
    this.faceScanning = true;
  }

  onFaceFailed(message: string): void {
    this.faceError = message;
    this.faceScanning = false;
  }

  onFaceCaptured(frames: string[]): void {
    if (this.faceBusy) return;
    this.faceBusy = true;
    this.service.enrollFace(this.faceUser, { consent: this.faceConsent, frames })
      .pipe(finalize(() => this.faceBusy = false), takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.message.success('Đã đăng ký khuôn mặt cho ' + this.faceUser);
          this.finishFace();
        },
        // CommonService đã báo lý do (ảnh không đạt, trùng tài khoản khác...); cho quét lại hoặc bỏ qua.
        error: () => {
          this.faceScanning = false;
          this.faceError = 'Đăng ký khuôn mặt chưa thành công. Hãy quét lại hoặc bỏ qua.';
        },
      });
  }

  /** Bỏ qua hoặc xong bước quét mặt → hiện mật khẩu tạm. Người dùng chưa có mặt sẽ được yêu cầu quét ở lần đăng nhập đầu. */
  finishFace(): void {
    this.faceVisible = false;
    this.faceScanning = false;
    const user = this.faceUser;
    const pw = this.pendingPassword;
    this.pendingPassword = '';
    this.showPassword(user, pw);
  }

  private afterSave(text: string): void {
    this.message.success(text);
    this.visible = false;
    this.search();
  }

  // ───────────────────────── Xóa tài khoản ─────────────────────────

  deleteVisible = false;
  deleteTarget: Employee | null = null;
  ownedMeetings: OwnedMeeting[] = [];
  /** meetingId → userName người nhận chủ trì ('' = không chuyển, xóa cuộc họp). */
  deleteTransfers: Record<string, string> = {};
  isDeleting = false;

  canDelete(item: Employee): boolean {
    return item.userName !== this.currentUser && !AccountService.isAdmin(item);
  }

  openDelete(item: Employee): void {
    this.deleteTarget = item;
    this.service.ownedMeetings(item.userName).pipe(takeUntil(this.destroy$)).subscribe(list => {
      this.ownedMeetings = list ?? [];
      this.deleteTransfers = {};
      this.ownedMeetings.forEach(m => this.deleteTransfers[m.meetingId] = m.candidates[0]?.userName ?? '');
      this.deleteVisible = true;
    });
  }

  get discardedMeetings(): OwnedMeeting[] {
    return this.ownedMeetings.filter(m => !this.deleteTransfers[m.meetingId]);
  }

  confirmDelete(): void {
    const target = this.deleteTarget;
    if (!target) return;
    const transfers = this.ownedMeetings
      .filter(m => this.deleteTransfers[m.meetingId])
      .map(m => ({ meetingId: m.meetingId, newOwner: this.deleteTransfers[m.meetingId] }));
    this.isDeleting = true;
    this.service.delete(target.userName, transfers)
      .pipe(finalize(() => this.isDeleting = false), takeUntil(this.destroy$))
      .subscribe(() => {
        this.message.success('Đã xóa tài khoản ' + target.userName);
        this.deleteVisible = false;
        this.search();
      });
  }

  // ───────────────────────── Thao tác ─────────────────────────

  openAction(kind: ActionKind, item: Employee): void {
    this.actionKind = kind;
    this.actionTarget = item;
    this.actionReason = '';
    this.actionValue = kind === 'transfer' ? item.orgId : kind === 'title' ? item.titleCode : '';
    this.actionVisible = true;
  }

  get actionTitle(): string {
    switch (this.actionKind) {
      case 'transfer': return 'ĐIỀU CHUYỂN PHÒNG BAN';
      case 'title': return 'ĐỔI CHỨC DANH';
      case 'lock': return 'KHÓA TÀI KHOẢN';
      default: return 'MỞ KHÓA TÀI KHOẢN';
    }
  }

  confirmAction(): void {
    const target = this.actionTarget;
    if (!target) return;
    let request$: Observable<unknown>;
    let done: string;
    switch (this.actionKind) {
      case 'transfer':
        if (!this.actionValue || this.actionValue === target.orgId) {
          this.message.warning('Chọn phòng ban mới khác phòng ban hiện tại');
          return;
        }
        request$ = this.service.transfer(target.userName, this.actionValue, this.actionReason.trim());
        done = 'Đã điều chuyển phòng ban';
        break;
      case 'title':
        if (!this.actionValue || this.actionValue === target.titleCode) {
          this.message.warning('Chọn chức danh mới khác chức danh hiện tại');
          return;
        }
        request$ = this.service.changeTitle(target.userName, this.actionValue);
        done = 'Đã đổi chức danh';
        break;
      default: {
        const activate = this.actionKind === 'unlock';
        request$ = this.service.changeStatus(target.userName, activate, this.actionReason.trim());
        done = activate ? 'Đã mở khóa tài khoản' : 'Đã khóa tài khoản, các phiên đăng nhập bị thu hồi';
      }
    }
    this.isActing = true;
    request$
      .pipe(finalize(() => this.isActing = false), takeUntil(this.destroy$))
      .subscribe(() => {
        this.message.success(done);
        this.actionVisible = false;
        this.search();
      });
  }

  resetPassword(item: Employee): void {
    this.service.resetPassword(item.userName)
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => this.showPassword(res.userName, res.temporaryPassword));
  }

  private showPassword(userName: string, password: string): void {
    if (!password) return;
    this.passwordUser = userName;
    this.temporaryPassword = password;
    this.passwordVisible = true;
  }

  copyPassword(): void {
    navigator.clipboard?.writeText(this.temporaryPassword)
      .then(() => this.message.success('Đã sao chép mật khẩu tạm'))
      .catch(() => this.message.warning('Không sao chép được, hãy chép thủ công'));
  }

  closePassword(): void {
    this.passwordVisible = false;
    this.temporaryPassword = '';
  }

  ngOnDestroy(): void {
    this.temporaryPassword = '';
    this.global.setBreadcrumb([]);
    this.destroy$.next();
    this.destroy$.complete();
  }
}

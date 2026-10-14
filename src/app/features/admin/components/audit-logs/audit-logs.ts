import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { GlobalService } from '../../../../core';
import { PaginationResult } from '../../../../shared/models';
import { SystemService } from '../../services/system.service';
import { AuditLog, AuditLogFilter } from '../../models/admin.models';

/** Nhãn tiếng Việt cho nhóm/hành động do BE ghi (@Audited). Phase sau thêm nhóm MINUTES, FILE vào đây. */
export const AUDIT_CATEGORIES: { value: string; label: string; color: string }[] = [
  { value: 'AUTH', label: 'Đăng nhập', color: 'blue' },
  { value: 'ACCOUNT', label: 'Tài khoản', color: 'cyan' },
  { value: 'PERMISSION', label: 'Phân quyền', color: 'purple' },
  { value: 'ORGANIZATION', label: 'Tổ chức', color: 'geekblue' },
  { value: 'TITLE', label: 'Chức danh', color: 'orange' },
  { value: 'SETTINGS', label: 'Cấu hình', color: 'gold' },
  { value: 'MEETING', label: 'Cuộc họp', color: 'green' },
];

const ACTION_LABELS: Record<string, string> = {
  'AUTH.LOGIN': 'Đăng nhập',
  'AUTH.LOGOUT': 'Đăng xuất',
  'AUTH.CHANGE_PASSWORD': 'Đổi mật khẩu',
  'AUTH.FORGOT_PASSWORD': 'Yêu cầu đặt lại mật khẩu',
  'AUTH.RESET_PASSWORD': 'Đặt lại mật khẩu bằng mã',
  'ACCOUNT.UPDATE_PROFILE': 'Cập nhật hồ sơ cá nhân',
  'ACCOUNT.CREATE': 'Tạo tài khoản',
  'ACCOUNT.UPDATE': 'Sửa tài khoản',
  'ACCOUNT.TRANSFER': 'Điều chuyển phòng ban',
  'ACCOUNT.CHANGE_TITLE': 'Đổi chức danh',
  'ACCOUNT.CHANGE_STATUS': 'Khóa / mở khóa',
  'ACCOUNT.RESET_PASSWORD': 'Đặt lại mật khẩu (admin)',
  'PERMISSION.UPDATE': 'Sửa phân quyền',
  'ORGANIZATION.CREATE': 'Thêm phòng ban',
  'ORGANIZATION.UPDATE': 'Sửa phòng ban',
  'ORGANIZATION.MOVE': 'Di chuyển phòng ban',
  'ORGANIZATION.DELETE': 'Xóa phòng ban',
  'TITLE.CREATE': 'Thêm chức danh',
  'TITLE.UPDATE': 'Sửa chức danh',
  'TITLE.DELETE': 'Xóa chức danh',
  'SETTINGS.UPDATE': 'Sửa cấu hình hệ thống',
  'SETTINGS.UPLOAD_TEMPLATE': 'Tải lên mẫu biên bản',
  'SETTINGS.SET_DEFAULT_TEMPLATE': 'Đặt mẫu biên bản mặc định',
  'SETTINGS.DELETE_TEMPLATE': 'Xóa mẫu biên bản',
  'MEETING.CREATE': 'Tạo cuộc họp',
  'MEETING.CREATE_QUICK': 'Tạo cuộc họp nhanh',
  'MEETING.CANCEL': 'Hủy cuộc họp',
  'MEETING.DELETE': 'Xóa cuộc họp nháp',
  'MEETING.ARCHIVE': 'Lưu trữ cuộc họp',
  'MEETING.ADD_PARTICIPANTS': 'Thêm người tham gia',
  'MEETING.REMOVE_PARTICIPANT': 'Xóa người tham gia',
};

/** P6 — Nhật ký hoạt động (mẫu 2.FrontEnd log-system, history-login). Chỉ đọc. */
@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [SharedModules],
  templateUrl: './audit-logs.html',
  styleUrl: './audit-logs.scss'
})
export class AuditLogs implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  readonly categories = AUDIT_CATEGORIES;
  filter: AuditLogFilter = new AuditLogFilter();
  range: Date[] = [];
  data: PaginationResult = new PaginationResult();

  detailVisible = false;
  detail: AuditLog | null = null;

  constructor(
    private global: GlobalService,
    private service: SystemService,
  ) {
    this.global.setBreadcrumb([{ name: 'Nhật ký hoạt động', path: 'admin/audit-logs' }]);
  }

  ngOnInit(): void {
    this.search();
  }

  search(): void {
    this.filter.from = this.range?.[0] ? AuditLogs.startOfDay(this.range[0]) : null;
    this.filter.to = this.range?.[1] ? AuditLogs.endOfDay(this.range[1]) : null;
    this.service.auditLogs(this.filter)
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

  reset(): void {
    this.filter = new AuditLogFilter();
    this.range = [];
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

  trackById(_: number, item: AuditLog): string {
    return item.id;
  }

  categoryLabel(value: string): string {
    return this.categories.find(c => c.value === value)?.label ?? value;
  }

  categoryColor(value: string): string {
    return this.categories.find(c => c.value === value)?.color ?? 'default';
  }

  actionLabel(log: AuditLog): string {
    if (log.category === 'ACCOUNT' && log.action === 'CHANGE_STATUS') {
      const active = this.parsed(log)?.request?.isActive;
      if (active === true) return 'Mở khóa tài khoản';
      if (active === false) return 'Khóa tài khoản';
    }
    return ACTION_LABELS[`${log.category}.${log.action}`] ?? log.action;
  }

  time(log: AuditLog): Date | null {
    return SystemService.fromUtcLocal(log.occurredAt);
  }

  open(log: AuditLog): void {
    this.detail = log;
    this.detailVisible = true;
  }

  parsed(log: AuditLog | null): any {
    if (!log?.payloadJson) return null;
    try {
      return JSON.parse(log.payloadJson);
    } catch {
      return null;
    }
  }

  prettyPayload(log: AuditLog | null): string {
    const value = this.parsed(log);
    return value ? JSON.stringify(value, null, 2) : (log?.payloadJson ?? '');
  }

  private static startOfDay(d: Date): Date {
    const r = new Date(d);
    r.setHours(0, 0, 0, 0);
    return r;
  }

  private static endOfDay(d: Date): Date {
    const r = new Date(d);
    r.setHours(24, 0, 0, 0);
    return r;
  }

  ngOnDestroy(): void {
    this.global.setBreadcrumb([]);
    this.destroy$.next();
    this.destroy$.complete();
  }
}

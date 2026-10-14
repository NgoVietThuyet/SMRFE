import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, debounceTime, finalize, takeUntil } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzFormatEmitEvent, NzTreeNodeOptions } from 'ng-zorro-antd/tree';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { GlobalService, SessionService } from '../../../../core';
import { APP_RIGHTS } from '../../../../shared/constants';
import { OrganizationService } from '../../../admin/services/organization.service';
import { OrganizationNode } from '../../../admin/models/admin.models';
import { MeetingForm } from '../../../meeting/components/meeting-form/meeting-form';
import { MeetingDetail, UserSearchItem } from '../../../meeting/models/meeting.models';
import { TaskUi } from '../../../task/utils/task-ui';
import { Contact, ContactsService } from '../../services/contacts.service';
import { AssignTaskModal } from '../assign-task-modal/assign-task-modal';

/**
 * P15 — Danh bạ `/contacts` (mẫu system-manager/components/contact + bố cục cây phòng ban của trang Tài khoản P3).
 * Chỉ xem: không có nút sửa, khoá, đặt lại mật khẩu. Drawer thông tin có [Mời họp] và [Giao việc].
 * Tìm không phân biệt dấu (BE /api/contacts xử lý); chọn phòng ban gồm cả phòng ban con.
 */
@Component({
  selector: 'app-contacts',
  standalone: true,
  imports: [SharedModules, MeetingForm, AssignTaskModal],
  templateUrl: './contacts.html',
  styleUrl: './contacts.scss',
})
export class Contacts implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private search$ = new Subject<void>();
  readonly ui = TaskUi;

  organizations: OrganizationNode[] = [];
  orgTree: NzTreeNodeOptions[] = [];
  organizationId: string | null = null;
  keyword = '';
  page = 1;
  pageSize = 50;
  items: Contact[] = [];
  total = 0;
  loading = false;

  selected: Contact | null = null;
  me = '';
  canCreateMeeting = false;

  // Mời họp / giao việc
  meetingVisible = false;
  meetingInvitees: UserSearchItem[] = [];
  assignTarget: Contact | null = null;
  lastAssigned: { workId: string; cardId: string; name: string } | null = null;

  constructor(
    private global: GlobalService,
    private session: SessionService,
    private service: ContactsService,
    private orgService: OrganizationService,
    private router: Router,
    private message: NzMessageService,
  ) {
    this.global.setBreadcrumb([{ name: 'Danh bạ', path: 'contacts' }]);
  }

  ngOnInit(): void {
    this.me = (this.session.accountInfo?.userName ?? '').toLowerCase();
    // Ai cũng tạo được cuộc họp (người tạo là chủ trì).
    this.canCreateMeeting = true;
    this.orgService.tree(false).pipe(takeUntil(this.destroy$)).subscribe(list => {
      this.organizations = (list ?? []).filter(o => o.isActive);
      this.orgTree = OrganizationService.toNzTree(this.organizations, { expandAll: true });
    });
    // Gõ tới đâu tìm tới đó (chờ 300ms).
    this.search$.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe(() => {
      this.page = 1;
      this.load();
    });
    this.load();
  }

  ngOnDestroy(): void {
    this.global.setBreadcrumb([]);
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.service.search(this.organizationId, this.keyword.trim(), this.page, this.pageSize)
      .pipe(finalize(() => this.loading = false), takeUntil(this.destroy$))
      .subscribe(res => {
        this.items = res?.items ?? [];
        this.total = res?.totalItems ?? 0;
      });
  }

  onKeywordChange(): void {
    this.search$.next();
  }

  reset(): void {
    this.keyword = '';
    this.organizationId = null;
    this.page = 1;
    this.load();
  }

  onOrgClick(event: NzFormatEmitEvent): void {
    const key = event.node?.key ?? null;
    this.organizationId = this.organizationId === key ? null : key;
    this.page = 1;
    this.load();
  }

  clearOrg(): void {
    this.organizationId = null;
    this.page = 1;
    this.load();
  }

  get selectedOrgName(): string {
    return this.organizations.find(o => o.id === this.organizationId)?.name ?? 'Tất cả phòng ban';
  }

  pageIndexChange(page: number): void {
    this.page = page;
    this.load();
  }

  pageSizeChange(size: number): void {
    this.pageSize = size;
    this.page = 1;
    this.load();
  }

  trackByUser = (_: number, c: Contact) => c.userName;

  isMe(c: Contact | null): boolean {
    return !!c && c.userName.toLowerCase() === this.me;
  }

  // ===================== Drawer + thao tác =====================

  open(c: Contact): void {
    this.selected = c;
  }

  copy(text: string | null, what: string): void {
    if (!text) return;
    navigator.clipboard?.writeText(text).then(
      () => this.message.success(`Đã sao chép ${what}`),
      () => this.message.warning('Trình duyệt không cho phép sao chép'));
  }

  inviteToMeeting(c: Contact): void {
    this.meetingInvitees = [{ userName: c.userName, fullName: c.fullName, email: c.email ?? '' }];
    this.selected = null;
    this.meetingVisible = true;
  }

  onMeetingSaved(d: MeetingDetail): void {
    if (d?.id) this.router.navigate(['/meetings', d.id]);
  }

  assignTask(c: Contact): void {
    this.selected = null;
    this.assignTarget = c;
  }

  onAssigned(e: { workId: string; cardId: string }, name: string): void {
    this.lastAssigned = { ...e, name };
  }

  openAssigned(): void {
    if (!this.lastAssigned) return;
    this.router.navigate(['/tasks', this.lastAssigned.workId], { queryParams: { card: this.lastAssigned.cardId } });
  }
}

import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged, finalize, takeUntil } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzFormatEmitEvent, NzTreeNodeOptions } from 'ng-zorro-antd/tree';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { GlobalService } from '../../../../core';
import { StringUtils } from '../../../../shared/utils';
import { AccountService } from '../../services/account.service';
import { OrganizationService } from '../../services/organization.service';
import { PermissionService } from '../../services/permission.service';
import { TitleService } from '../../services/title.service';
import {
  EffectivePermission, Employee, EmployeeFilter, OrganizationNode, PermissionCatalogGroup, PermissionEffect,
  PermissionTargetType, Title,
} from '../../models/admin.models';

interface SelectedTarget {
  type: PermissionTargetType;
  id: string;
  name: string;
  isAdmin: boolean;
}

interface PendingChange {
  code: string;
  name: string;
  from: PermissionEffect;
  to: PermissionEffect;
}

const EFFECT_LABEL: Record<PermissionEffect, string> = { Inherit: 'Kế thừa', Allow: 'Cho phép', Deny: 'Từ chối' };
const SOURCE_LABEL: Record<string, string> = {
  USER: 'Tài khoản', TITLE: 'Chức danh', ORGANIZATION: 'Phòng ban', ROLE: 'Vai trò hệ thống',
  DEFAULT: 'Mặc định (từ chối)', INVALID_JSON: 'Cấu hình lỗi',
};

/**
 * P4 — Phân quyền (mẫu 2.FrontEnd system-manager/right).
 * Thứ tự áp dụng ở BE: Tài khoản → Chức danh → Phòng ban; giá trị đầu tiên khác "Kế thừa" thắng, không có thì từ chối.
 */
@Component({
  selector: 'app-permissions',
  standalone: true,
  imports: [SharedModules],
  templateUrl: './permissions.html',
  styleUrl: './permissions.scss'
})
export class Permissions implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private accountSearch$ = new Subject<string>();

  readonly effectOptions = [
    { label: 'Kế thừa', value: 'Inherit' },
    { label: 'Cho phép', value: 'Allow' },
    { label: 'Từ chối', value: 'Deny' },
  ];

  catalog: PermissionCatalogGroup[] = [];
  orgTree: NzTreeNodeOptions[] = [];
  organizations: OrganizationNode[] = [];
  titles: Title[] = [];
  accounts: Employee[] = [];
  titleKeyword = '';
  accountKeyword = '';
  leftTab = 0;

  selected: SelectedTarget | null = null;
  original: Record<string, PermissionEffect> = {};
  current: Record<string, PermissionEffect> = {};
  isSaving = false;
  rightTab = 0;

  effective: EffectivePermission[] = [];
  effectiveLoading = false;

  constructor(
    private global: GlobalService,
    private permissionService: PermissionService,
    private orgService: OrganizationService,
    private titleService: TitleService,
    private accountService: AccountService,
    private message: NzMessageService,
    private modal: NzModalService,
  ) {
    this.global.setBreadcrumb([{ name: 'Phân quyền', path: 'admin/permissions' }]);
  }

  ngOnInit(): void {
    this.permissionService.catalog().pipe(takeUntil(this.destroy$)).subscribe(c => this.catalog = c ?? []);
    this.orgService.tree(false).pipe(takeUntil(this.destroy$)).subscribe(list => {
      this.organizations = list ?? [];
      this.orgTree = OrganizationService.toNzTree(this.organizations, { expandAll: true });
    });
    this.titleService.list(false).pipe(takeUntil(this.destroy$)).subscribe(list => this.titles = list ?? []);
    this.accountSearch$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe(keyword => this.loadAccounts(keyword));
    this.loadAccounts('');
  }

  // ───────────────────────── Chọn đối tượng ─────────────────────────

  get filteredTitles(): Title[] {
    const keyword = StringUtils.normalizeSearch(this.titleKeyword);
    return this.titles.filter(t => !keyword || StringUtils.normalizeSearch(`${t.code} ${t.name}`).includes(keyword));
  }

  onAccountKeyword(value: string): void {
    this.accountSearch$.next(value.trim());
  }

  private loadAccounts(keyword: string): void {
    const filter = { ...new EmployeeFilter(), keyword, pageSize: 50 };
    this.accountService.search(filter).pipe(takeUntil(this.destroy$)).subscribe(res => this.accounts = res.data ?? []);
  }

  selectOrganization(event: NzFormatEmitEvent): void {
    const node = event.node;
    if (!node) return;
    this.select({ type: 'organization', id: String(node.key), name: node.title, isAdmin: false });
  }

  selectTitle(t: Title): void {
    this.select({ type: 'title', id: t.code, name: t.name, isAdmin: false });
  }

  selectAccount(a: Employee): void {
    this.select({ type: 'account', id: a.userName, name: `${a.fullName} (${a.userName})`, isAdmin: AccountService.isAdmin(a) });
  }

  isSelected(type: PermissionTargetType, id: string): boolean {
    return this.selected?.type === type && this.selected.id === id;
  }

  private select(target: SelectedTarget): void {
    if (this.hasChanges && !confirm('Có thay đổi chưa lưu. Bỏ thay đổi và chuyển đối tượng?')) {
      return;
    }
    this.selected = target;
    this.rightTab = 0;
    this.effective = [];
    this.permissionService.get(target.type, target.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(doc => {
        const map: Record<string, PermissionEffect> = {};
        for (const def of this.allDefinitions) {
          map[def.code] = (doc?.permissions?.[def.code] as PermissionEffect) ?? 'Inherit';
        }
        this.original = { ...map };
        this.current = { ...map };
      });
    if (target.type === 'account') {
      this.loadEffective();
    }
  }

  // ───────────────────────── Ma trận quyền ─────────────────────────

  get allDefinitions() {
    return this.catalog.flatMap(g => g.permissions);
  }

  get pendingChanges(): PendingChange[] {
    return this.allDefinitions
      .filter(d => (this.current[d.code] ?? 'Inherit') !== (this.original[d.code] ?? 'Inherit'))
      .map(d => ({ code: d.code, name: d.name, from: this.original[d.code] ?? 'Inherit', to: this.current[d.code] }));
  }

  get hasChanges(): boolean {
    return this.pendingChanges.length > 0;
  }

  countIn(group: PermissionCatalogGroup, effect: PermissionEffect): number {
    return group.permissions.filter(p => (this.current[p.code] ?? 'Inherit') === effect).length;
  }

  setGroup(group: PermissionCatalogGroup, effect: PermissionEffect, event: Event): void {
    event.stopPropagation();
    for (const p of group.permissions) {
      this.current[p.code] = effect;
    }
  }

  effectLabel(effect: PermissionEffect): string {
    return EFFECT_LABEL[effect] ?? effect;
  }

  discard(): void {
    this.current = { ...this.original };
  }

  /** Xác nhận danh sách thay đổi rồi gửi. Mục "Kế thừa" không gửi lên (BE coi thiếu = kế thừa). */
  confirmSave(): void {
    const target = this.selected;
    const changes = this.pendingChanges;
    if (!target || !changes.length) return;
    const lines = changes.map(c => `• ${c.name}: ${this.effectLabel(c.from)} → ${this.effectLabel(c.to)}`).join('\n');
    this.modal.confirm({
      nzTitle: `Lưu ${changes.length} thay đổi quyền cho ${target.name}?`,
      nzContent: lines,
      nzOkText: 'Lưu',
      nzCancelText: 'Huỷ',
      nzWrapClassName: 'permission-confirm',
      nzOnOk: () => this.save(target),
    });
  }

  private save(target: SelectedTarget): void {
    const permissions: Record<string, PermissionEffect> = {};
    for (const [code, effect] of Object.entries(this.current)) {
      if (effect !== 'Inherit') permissions[code] = effect;
    }
    this.isSaving = true;
    this.permissionService.save(target.type, target.id, { version: 1, permissions })
      .pipe(finalize(() => this.isSaving = false), takeUntil(this.destroy$))
      .subscribe(() => {
        this.original = { ...this.current };
        this.message.success('Đã lưu phân quyền. Người dùng tải lại trang là có hiệu lực.');
        if (target.type === 'account') this.loadEffective();
      });
  }

  // ───────────────────────── Quyền hiệu lực ─────────────────────────

  loadEffective(): void {
    const target = this.selected;
    if (!target || target.type !== 'account') return;
    this.effectiveLoading = true;
    this.permissionService.effective(target.id)
      .pipe(finalize(() => this.effectiveLoading = false), takeUntil(this.destroy$))
      .subscribe(list => this.effective = list ?? []);
  }

  sourceLabel(p: EffectivePermission): string {
    const type = SOURCE_LABEL[p.sourceType] ?? p.sourceType;
    return p.sourceName ? `${type}: ${p.sourceName}` : type;
  }

  ngOnDestroy(): void {
    this.global.setBreadcrumb([]);
    this.destroy$.next();
    this.destroy$.complete();
  }
}

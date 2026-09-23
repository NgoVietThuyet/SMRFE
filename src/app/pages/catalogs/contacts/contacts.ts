import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAvatarModule } from 'ng-zorro-antd/avatar';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzTreeModule } from 'ng-zorro-antd/tree';
import type { NzFormatEmitEvent, NzTreeNodeOptions } from 'ng-zorro-antd/core/tree';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { DirectoryService } from '../../../core/services/directory.service';
import type {
    DirectoryEmployee,
    DirectoryTitle,
    OrganizationFlat,
} from '../../../core/models/directory.models';

// Node cây mang thêm số liệu + trạng thái để template hiển thị (không hard-code org nào)
interface OrgTreeNode extends NzTreeNodeOptions {
    orgId: string;
    isActive: boolean;
    directCount: number;
    subtreeCount: number;
    children: OrgTreeNode[];
}

// =====================================================
// Contacts — Module Danh bạ: cây cơ cấu tổ chức (dựng
// client-side từ Id/PId) + chi tiết phòng ban + nhân sự.
// Expand/collapse thuần UI. Không username/password/role
// trên FE — BE tự sinh tài khoản (directory-employees).
// =====================================================
@Component({
    selector: 'app-contacts',
    templateUrl: './contacts.html',
    styleUrl: './contacts.scss',
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        NzAvatarModule,
        NzButtonModule,
        NzDrawerModule,
        NzEmptyModule,
        NzFormModule,
        NzIconModule,
        NzInputModule,
        NzModalModule,
        NzPaginationModule,
        NzSelectModule,
        NzSpinModule,
        NzSwitchModule,
        NzTooltipModule,
        NzTreeModule,
    ],
})
export class Contacts implements OnInit {
    private readonly directory = inject(DirectoryService);
    private readonly fb = inject(FormBuilder);
    private readonly message = inject(NzMessageService);
    private readonly modal = inject(NzModalService);
    private readonly destroyRef = inject(DestroyRef);

    // ── Nguồn dữ liệu ──
    orgsFlat = signal<OrganizationFlat[]>([]);
    titles = signal<DirectoryTitle[]>([]);
    orgLoading = signal<boolean>(true);
    orgError = signal<string | null>(null);

    // ── Cây: expand thuần UI, search lọc client-side + auto-expand cha ──
    treeKeyword = signal<string>('');
    expandedKeys = signal<string[]>([]);
    private orgsLoadedOnce = false;

    // ── Danh sách nhân sự (server-side filter + paging) ──
    empKeyword = signal<string>('');
    titleFilter = signal<string | null>(null);
    activeFilter = signal<boolean | null>(null);
    items = signal<DirectoryEmployee[]>([]);
    page = signal<number>(1);
    readonly pageSize = 20;
    total = signal<number>(0);
    empLoading = signal<boolean>(true);
    empError = signal<string | null>(null);
    private readonly empKeyword$ = new Subject<string>();

    // ── Lựa chọn ──
    selectedOrgId = signal<string | null>(null);
    selectedKeys = computed<string[]>(() => {
        const id = this.selectedOrgId();
        return id ? [id] : [];
    });

    // ── Drawer chi tiết nhân sự ──
    detailOpen = signal<boolean>(false);
    detail = signal<DirectoryEmployee | null>(null);
    detailLoading = signal<boolean>(false);
    detailError = signal<string | null>(null);

    // ── Drawer form nhân sự (create / edit) ──
    empFormOpen = signal<boolean>(false);
    editingUser = signal<string | null>(null); // null = thêm mới
    empSaving = signal<boolean>(false);
    empForm = this.fb.group({
        fullName: ['', [Validators.required, Validators.maxLength(200)]],
        email: ['', [Validators.required, Validators.email]],
        phone: [''],
        address: [''],
        organizationId: ['', Validators.required],
        titleCode: ['', Validators.required],
    });

    // ── Drawer form phòng ban (create / edit) ──
    orgFormOpen = signal<boolean>(false);
    editingOrgId = signal<string | null>(null); // null = thêm mới
    orgSaving = signal<boolean>(false);
    orgForm = this.fb.group({
        name: ['', [Validators.required, Validators.maxLength(200)]],
        parentId: [''],
        orderNumber: [1],
        isActive: [true],
        notes: [''],
    });

    readonly activeOptions = [
        { value: null as boolean | null, label: 'Mọi trạng thái' },
        { value: true, label: 'Đang hoạt động' },
        { value: false, label: 'Đã khóa' },
    ];

    // ── Cây đầy đủ dựng từ flat Id/PId ──
    readonly treeNodes = computed<OrgTreeNode[]>(() => this.buildTree(this.orgsFlat(), ''));

    // ── Cây hiển thị sau search: giữ node khớp + toàn bộ cha ──
    readonly visibleNodes = computed<OrgTreeNode[]>(() => {
        const kw = this.treeKeyword().trim().toLowerCase();
        if (!kw) return this.treeNodes();
        const out: OrgTreeNode[] = [];
        for (const root of this.treeNodes()) {
            const hit = this.filterNode(root, kw);
            if (hit) out.push(hit);
        }
        return out;
    });

    // ── Phòng ban đang chọn ──
    readonly selectedOrg = computed<OrganizationFlat | null>(() => {
        const id = this.selectedOrgId();
        return this.orgsFlat().find((o) => o.id === id) ?? null;
    });

    readonly selectedSubtreeCount = computed<number>(() => {
        const id = this.selectedOrgId();
        if (!id) return 0;
        const found = this.findNode(this.treeNodes(), id);
        return found?.subtreeCount ?? 0;
    });

    orgName(id: string | null | undefined): string {
        if (!id) return 'Đơn vị gốc';
        return this.orgsFlat().find((o) => o.id === id)?.name ?? id;
    }

    // Options phòng ban cho select (indent theo độ sâu)
    readonly orgSelectOptions = computed<{ value: string; label: string; disabled: boolean }[]>(() => {
        const depth = new Map<string, number>();
        const walk = (nodes: OrgTreeNode[], d: number): void => {
            for (const n of nodes) {
                depth.set(n.orgId, d);
                walk(n.children, d + 1);
            }
        };
        walk(this.treeNodes(), 0);
        return this.orgsFlat().map((o) => ({
            value: o.id,
            label: `${'— '.repeat(depth.get(o.id) ?? 0)}${o.name}`,
            disabled: !o.isActive,
        }));
    });

    // Options cha cho form phòng ban (loại self + cây con khi sửa)
    parentOptions(): { value: string; label: string }[] {
        const editing = this.editingOrgId();
        const excluded = new Set<string>();
        if (editing) {
            excluded.add(editing);
            const node = this.findNode(this.treeNodes(), editing);
            if (node) this.collectIds(node, excluded);
        }
        return this.orgSelectOptions()
            .filter((o) => !excluded.has(o.value))
            .map((o) => ({ value: o.value, label: o.label }));
    }

    constructor() {
        this.empKeyword$
            .pipe(debounceTime(400), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
            .subscribe(() => this.reloadEmployees());
    }

    ngOnInit(): void {
        this.loadOrgs();
        this.loadTitles();
        this.loadEmployees();
    }

    // ── Tải dữ liệu ──

    loadOrgs(keepSelection = true): void {
        this.orgLoading.set(true);
        this.orgError.set(null);
        this.directory
            .organizations()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (orgs) => {
                    this.orgsFlat.set(orgs ?? []);
                    // Expand gợi ý BE chỉ lần đầu; các lần reload sau giữ expand UI-only
                    // (loại key của phòng ban đã bị xóa).
                    if (!this.orgsLoadedOnce) {
                        this.orgsLoadedOnce = true;
                        this.expandedKeys.set((orgs ?? []).filter((o) => o.expanded).map((o) => o.id));
                    } else {
                        const alive = new Set((orgs ?? []).map((o) => o.id));
                        this.expandedKeys.update((keys) => keys.filter((k) => alive.has(k)));
                    }
                    if (!keepSelection && this.selectedOrgId()) {
                        this.selectedOrgId.set(null);
                        this.reloadEmployees();
                    } else if (this.selectedOrgId() && !(orgs ?? []).some((o) => o.id === this.selectedOrgId())) {
                        this.selectedOrgId.set(null);
                        this.reloadEmployees();
                    }
                    this.orgLoading.set(false);
                },
                error: (err: Error) => {
                    this.orgLoading.set(false);
                    this.orgError.set(err.message || 'Không thể tải cơ cấu tổ chức.');
                },
            });
    }

    loadTitles(): void {
        this.directory
            .titles()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (titles) => this.titles.set(titles ?? []),
                error: () => this.titles.set([]),
            });
    }

    reloadEmployees(): void {
        this.page.set(1);
        this.loadEmployees();
    }

    loadEmployees(): void {
        this.empLoading.set(true);
        this.empError.set(null);
        this.directory
            .employees({
                organizationId: this.selectedOrgId(),
                titleCode: this.titleFilter(),
                active: this.activeFilter(),
                keyword: this.empKeyword().trim(),
                page: this.page(),
                pageSize: this.pageSize,
            })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (result) => {
                    this.items.set(result.items ?? []);
                    this.total.set(result.totalItems ?? 0);
                    this.empLoading.set(false);
                },
                error: (err: Error) => {
                    this.empLoading.set(false);
                    this.empError.set(err.message || 'Không thể tải danh sách nhân sự.');
                },
            });
    }

    // ── Cây: dựng + lọc ──

    private buildTree(list: OrganizationFlat[], _kw: string): OrgTreeNode[] {
        const sorted = [...list].sort(
            (a, b) => a.orderNumber - b.orderNumber || a.name.localeCompare(b.name, 'vi')
        );
        const map = new Map<string, OrgTreeNode>();
        for (const o of sorted) {
            map.set(o.id, {
                key: o.id,
                title: o.name,
                isLeaf: true,
                orgId: o.id,
                isActive: o.isActive,
                directCount: o.employeeCount ?? 0,
                subtreeCount: o.employeeCount ?? 0,
                children: [],
            });
        }
        const roots: OrgTreeNode[] = [];
        for (const o of sorted) {
            const node = map.get(o.id)!;
            const parent = o.pId ? map.get(o.pId) : undefined;
            if (parent) {
                parent.children.push(node);
                parent.isLeaf = false;
            } else {
                roots.push(node);
            }
        }
        const sum = (n: OrgTreeNode): number => {
            let s = n.directCount;
            for (const c of n.children) s += sum(c);
            n.subtreeCount = s;
            return s;
        };
        roots.forEach(sum);
        return roots;
    }

    private filterNode(node: OrgTreeNode, kw: string): OrgTreeNode | null {
        const matchedChildren: OrgTreeNode[] = [];
        for (const c of node.children) {
            const hit = this.filterNode(c, kw);
            if (hit) matchedChildren.push(hit);
        }
        const selfHit = (node.title as string).toLowerCase().includes(kw);
        if (!selfHit && matchedChildren.length === 0) return null;
        return { ...node, children: matchedChildren, isLeaf: matchedChildren.length === 0 };
    }

    private findNode(nodes: OrgTreeNode[], id: string): OrgTreeNode | null {
        for (const n of nodes) {
            if (n.orgId === id) return n;
            const hit = this.findNode(n.children, id);
            if (hit) return hit;
        }
        return null;
    }

    private collectIds(node: OrgTreeNode, out: Set<string>): void {
        for (const c of node.children) {
            out.add(c.orgId);
            this.collectIds(c, out);
        }
    }

    private collectParentIds(nodes: OrgTreeNode[], out: Set<string>): void {
        for (const n of nodes) {
            if (n.children.length > 0) {
                out.add(n.orgId);
                this.collectParentIds(n.children, out);
            }
        }
    }

    onTreeClick(e: NzFormatEmitEvent): void {
        const key = e?.node?.key as string | undefined;
        if (!key) return;
        this.selectedOrgId.set(key);
        this.reloadEmployees();
    }

    onTreeExpand(e: NzFormatEmitEvent): void {
        const key = e?.node?.key as string | undefined;
        if (!key) return;
        this.expandedKeys.update((keys) => {
            const set = new Set(keys);
            if (e?.node?.isExpanded) set.add(key);
            else set.delete(key);
            return [...set];
        });
    }

    onTreeSearch(value: string): void {
        this.treeKeyword.set(value);
        if (value.trim()) {
            // Search: auto-expand toàn bộ cha của node hiển thị
            const ids = new Set<string>();
            this.collectParentIds(this.visibleNodes(), ids);
            this.expandedKeys.set([...ids]);
        }
    }

    expandAll(): void {
        this.expandedKeys.set(this.orgsFlat().map((o) => o.id));
    }

    collapseAll(): void {
        this.expandedKeys.set([]);
    }

    clearOrgFilter(): void {
        this.selectedOrgId.set(null);
        this.reloadEmployees();
    }

    // ── Filter nhân sự ──

    onEmpKeywordInput(value: string): void {
        this.empKeyword.set(value);
        this.empKeyword$.next(value);
    }

    onTitleFilterChange(value: string | null): void {
        this.titleFilter.set(value);
        this.reloadEmployees();
    }

    onActiveFilterChange(value: boolean | null): void {
        this.activeFilter.set(value);
        this.reloadEmployees();
    }

    onPageChange(page: number): void {
        this.page.set(page);
        this.loadEmployees();
    }

    titleName(code: string | null): string {
        if (!code) return '—';
        return this.titles().find((t) => t.code === code)?.name ?? code;
    }

    // ── Chi tiết nhân sự (drawer) ──

    openEmpDetail(user: DirectoryEmployee): void {
        this.detailOpen.set(true);
        this.detailLoading.set(true);
        this.detailError.set(null);
        this.detail.set(user);
        this.directory
            .employee(user.userName)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (full) => {
                    this.detail.set(full);
                    this.detailLoading.set(false);
                },
                error: (err: Error) => {
                    this.detailLoading.set(false);
                    this.detailError.set(err.message || 'Không thể tải chi tiết nhân sự.');
                },
            });
    }

    closeEmpDetail(): void {
        this.detailOpen.set(false);
    }

    // ── Form nhân sự ──

    openEmpCreate(preselectOrg = true): void {
        this.editingUser.set(null);
        this.empForm.reset({
            fullName: '',
            email: '',
            phone: '',
            address: '',
            organizationId: preselectOrg ? (this.selectedOrgId() ?? '') : '',
            titleCode: '',
        });
        this.empFormOpen.set(true);
    }

    openEmpEdit(user: DirectoryEmployee): void {
        this.editingUser.set(user.userName);
        this.empForm.reset({
            fullName: user.fullName,
            email: user.email,
            phone: user.phone ?? '',
            address: user.address ?? '',
            organizationId: user.orgId,
            titleCode: user.titleCode,
        });
        this.detailOpen.set(false);
        this.empFormOpen.set(true);
    }

    closeEmpForm(): void {
        this.empFormOpen.set(false);
    }

    submitEmpForm(): void {
        if (this.empForm.invalid) {
            this.empForm.markAllAsTouched();
            return;
        }
        const v = this.empForm.getRawValue();
        this.empSaving.set(true);
        const editing = this.editingUser();
        const payload = {
            fullName: (v.fullName ?? '').trim(),
            email: (v.email ?? '').trim(),
            phone: (v.phone ?? '').trim(),
            address: (v.address ?? '').trim(),
            organizationId: v.organizationId ?? '',
            titleCode: v.titleCode ?? '',
        };
        const done = {
            next: () => {
                this.empSaving.set(false);
                this.empFormOpen.set(false);
                this.loadOrgs();
                this.loadEmployees();
                if (this.detailOpen() && this.detail()) this.openEmpDetail(this.detail()!);
            },
            error: (err: Error) => {
                this.empSaving.set(false);
                this.message.error(err.message || 'Lưu nhân sự thất bại.');
            },
        };
        if (editing) {
            this.directory
                .updateEmployee(editing, payload)
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe({ ...done, next: () => { this.message.success('Cập nhật nhân sự thành công.'); done.next(); } });
        } else {
            this.directory
                .createEmployee(payload)
                .pipe(takeUntilDestroyed(this.destroyRef))
                .subscribe({
                    ...done,
                    next: (userName: string) => {
                        // BE chỉ trả username — không hiển thị password
                        this.message.success(`Thêm nhân sự thành công — tên đăng nhập: ${userName}`);
                        done.next();
                    },
                });
        }
    }

    confirmToggleStatus(user: DirectoryEmployee): void {
        const action = user.isActive ? 'khóa' : 'mở khóa';
        this.modal.confirm({
            nzTitle: `${user.isActive ? 'Khóa' : 'Mở khóa'} tài khoản "${user.fullName}"?`,
            nzContent: user.isActive
                ? 'Tài khoản bị khóa không thể đăng nhập cho đến khi được mở lại.'
                : 'Tài khoản sẽ được phép đăng nhập trở lại.',
            nzOkText: 'Xác nhận',
            nzCancelText: 'Hủy',
            nzOnOk: () =>
                new Promise<void>((resolve, reject) => {
                    this.directory
                        .setStatus(user.userName, !user.isActive)
                        .subscribe({
                            next: () => {
                                this.message.success(`${user.isActive ? 'Đã khóa' : 'Đã mở khóa'} tài khoản.`);
                                this.loadEmployees();
                                if (this.detailOpen()) this.openEmpDetail({ ...user, isActive: !user.isActive });
                                resolve();
                            },
                            error: (err: Error) => {
                                this.message.error(err.message || `Không thể ${action} tài khoản.`);
                                reject(err);
                            },
                        });
                }),
        });
    }

    confirmResetPassword(user: DirectoryEmployee): void {
        this.modal.confirm({
            nzTitle: `Đặt lại mật khẩu cho "${user.fullName}"?`,
            nzContent: 'Hệ thống sinh mật khẩu mới, nhân sự phải đổi ở lần đăng nhập tiếp theo.',
            nzOkText: 'Xác nhận',
            nzCancelText: 'Hủy',
            nzOnOk: () =>
                new Promise<void>((resolve, reject) => {
                    this.directory.resetPassword(user.userName).subscribe({
                        next: () => {
                            this.message.success('Đã đặt lại mật khẩu.');
                            resolve();
                        },
                        error: (err: Error) => {
                            this.message.error(err.message || 'Đặt lại mật khẩu thất bại.');
                            reject(err);
                        },
                    });
                }),
        });
    }

    // ── Form phòng ban ──

    openOrgCreate(parentId: string | null = null): void {
        this.editingOrgId.set(null);
        const maxOrder = this.orgsFlat().reduce((m, o) => Math.max(m, o.orderNumber), 0);
        this.orgForm.reset({
            name: '',
            parentId: parentId ?? '',
            orderNumber: maxOrder + 1,
            isActive: true,
            notes: '',
        });
        this.orgFormOpen.set(true);
    }

    openOrgEdit(org: OrganizationFlat): void {
        this.editingOrgId.set(org.id);
        this.orgForm.reset({
            name: org.name,
            parentId: org.pId ?? '',
            orderNumber: org.orderNumber,
            isActive: org.isActive,
            notes: org.notes ?? '',
        });
        this.orgFormOpen.set(true);
    }

    closeOrgForm(): void {
        this.orgFormOpen.set(false);
    }

    submitOrgForm(): void {
        if (this.orgForm.invalid) {
            this.orgForm.markAllAsTouched();
            return;
        }
        const v = this.orgForm.getRawValue();
        const parentId = (v.parentId ?? '').trim();
        if (this.editingOrgId() && parentId === this.editingOrgId()) {
            this.message.error('Phòng ban cha không thể là chính nó.');
            return;
        }
        this.orgSaving.set(true);
        const payload = {
            name: (v.name ?? '').trim(),
            parentId: parentId || null,
            orderNumber: Number(v.orderNumber) || 0,
            isActive: v.isActive ?? true,
            notes: (v.notes ?? '').trim() || null,
        };
        const editing = this.editingOrgId();
        const req = editing
            ? this.directory.updateOrganization(editing, payload)
            : this.directory.createOrganization(payload);
        req.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
                this.orgSaving.set(false);
                this.orgFormOpen.set(false);
                this.message.success(editing ? 'Cập nhật phòng ban thành công.' : 'Thêm phòng ban thành công.');
                this.loadOrgs();
            },
            error: (err: Error) => {
                this.orgSaving.set(false);
                this.message.error(err.message || 'Lưu phòng ban thất bại.');
            },
        });
    }

    confirmDeleteOrg(org: OrganizationFlat): void {
        this.modal.confirm({
            nzTitle: `Xóa phòng ban "${org.name}"?`,
            nzContent: 'Chỉ xóa được khi không còn đơn vị con và nhân sự.',
            nzOkText: 'Xóa',
            nzOkDanger: true,
            nzCancelText: 'Hủy',
            nzOnOk: () =>
                new Promise<void>((resolve, reject) => {
                    this.directory.deleteOrganization(org.id).subscribe({
                        next: () => {
                            this.message.success('Đã xóa phòng ban.');
                            if (this.selectedOrgId() === org.id) {
                                this.selectedOrgId.set(null);
                                this.loadEmployees();
                            }
                            this.loadOrgs();
                            resolve();
                        },
                        error: (err: Error) => {
                            this.message.error(err.message || 'Xóa phòng ban thất bại.');
                            reject(err);
                        },
                    });
                }),
        });
    }

    // ── Hiển thị ──

    initials(name: string | null): string {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
}

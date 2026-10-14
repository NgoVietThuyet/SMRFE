import { Component, OnDestroy, OnInit } from '@angular/core';
import { Observable, Subject, concat, finalize, last, of, takeUntil } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzFormatEmitEvent, NzTreeNode, NzTreeNodeOptions } from 'ng-zorro-antd/tree';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { GlobalService } from '../../../../core';
import { StringUtils } from '../../../../shared/utils';
import { OrganizationService } from '../../services/organization.service';
import { OrganizationDto, OrganizationNode } from '../../models/admin.models';

/** P1 — Cơ cấu tổ chức (mẫu 2.FrontEnd master-data/organize): cây phòng ban, kéo thả để đổi cha/thứ tự. */
@Component({
  selector: 'app-organizations',
  standalone: true,
  imports: [SharedModules],
  templateUrl: './organizations.html',
  styleUrl: './organizations.scss'
})
export class Organizations implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  list: OrganizationNode[] = [];
  treeData: NzTreeNodeOptions[] = [];
  parentOptions: NzTreeNodeOptions[] = [];
  keyword = '';
  isMoving = false;

  visible = false;
  isEdit = false;
  editingId = '';
  isSaving = false;
  dto: OrganizationDto = new OrganizationDto();

  constructor(
    private global: GlobalService,
    private service: OrganizationService,
    private message: NzMessageService,
  ) {
    this.global.setBreadcrumb([{ name: 'Cơ cấu tổ chức', path: 'admin/organizations' }]);
  }

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.service.tree()
      .pipe(takeUntil(this.destroy$))
      .subscribe(list => {
        this.list = list ?? [];
        this.rebuild();
      });
  }

  private rebuild(): void {
    const keyword = StringUtils.normalizeSearch(this.keyword);
    const tree = OrganizationService.toNzTree(this.list, { expandAll: true });
    this.treeData = keyword ? this.filterTree(tree, keyword) : tree;
  }

  onSearch(): void {
    this.rebuild();
  }

  reset(): void {
    this.keyword = '';
    this.load();
  }

  /** Giữ nút khớp từ khóa (có dấu/không dấu) cùng toàn bộ nhánh cha. */
  private filterTree(nodes: NzTreeNodeOptions[], keyword: string): NzTreeNodeOptions[] {
    return nodes.reduce((acc: NzTreeNodeOptions[], node) => {
      const children = this.filterTree(node.children ?? [], keyword);
      if (StringUtils.normalizeSearch(node.title).includes(keyword) || children.length) {
        acc.push({ ...node, children, isLeaf: children.length === 0, expanded: true });
      }
      return acc;
    }, []);
  }

  get totalEmployees(): number {
    return this.list.reduce((sum, o) => sum + (o.employeeCount ?? 0), 0);
  }

  // ───────────────────────── Drawer ─────────────────────────

  create(parentId: string = ''): void {
    this.isEdit = false;
    this.editingId = '';
    this.dto = new OrganizationDto();
    this.dto.parentId = parentId;
    this.dto.orderNumber = this.list.filter(o => (o.pId || '') === parentId).length + 1;
    this.parentOptions = OrganizationService.toNzTree(this.list, { expandAll: true });
    this.visible = true;
  }

  edit(node: OrganizationNode): void {
    this.isEdit = true;
    this.editingId = node.id;
    this.dto = {
      name: node.name,
      parentId: node.pId || '',
      orderNumber: node.orderNumber,
      isActive: node.isActive,
      notes: node.notes ?? '',
    };
    // Không cho chọn chính nó hoặc nhánh con làm cha.
    const excluded = this.descendantIds(node.id);
    this.parentOptions = OrganizationService.toNzTree(this.list.filter(o => !excluded.has(o.id)), { expandAll: true });
    this.visible = true;
  }

  close(): void {
    this.visible = false;
  }

  save(): void {
    if (!this.dto.name?.trim()) {
      this.message.warning('Vui lòng nhập tên phòng ban');
      return;
    }
    const body: OrganizationDto = { ...this.dto, name: this.dto.name.trim(), parentId: this.dto.parentId || '' };
    const request$ = this.isEdit ? this.service.update(this.editingId, body) : this.service.create(body);
    this.isSaving = true;
    request$
      .pipe(finalize(() => this.isSaving = false), takeUntil(this.destroy$))
      .subscribe(() => {
        this.message.success(this.isEdit ? 'Đã cập nhật phòng ban' : 'Đã thêm phòng ban');
        this.visible = false;
        this.load();
      });
  }

  remove(node: OrganizationNode): void {
    this.service.delete(node.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.message.success('Đã xóa phòng ban');
        if (this.visible && this.editingId === node.id) this.visible = false;
        this.load();
      });
  }

  canDelete(node: OrganizationNode): boolean {
    return !node.employeeCount && !this.list.some(o => o.pId === node.id);
  }

  deleteHint(node: OrganizationNode): string {
    if (node.employeeCount) return `Còn ${node.employeeCount} nhân sự, hãy điều chuyển trước khi xóa`;
    if (this.list.some(o => o.pId === node.id)) return 'Còn phòng ban con, hãy chuyển hoặc xóa trước';
    return 'Xóa phòng ban';
  }

  private descendantIds(id: string): Set<string> {
    const result = new Set<string>([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const o of this.list) {
        if (o.pId && result.has(o.pId) && !result.has(o.id)) {
          result.add(o.id);
          changed = true;
        }
      }
    }
    return result;
  }

  // ───────────────────────── Kéo thả ─────────────────────────

  /** Không thả khi đang tìm kiếm (cây đang bị lọc) hoặc khi đang lưu lần kéo trước. */
  beforeDrop = (): Observable<boolean> => {
    if (this.keyword.trim()) {
      this.message.info('Xóa từ khóa tìm kiếm trước khi kéo thả');
    }
    return of(!this.keyword.trim() && !this.isMoving);
  };

  /**
   * Sau khi thả: nút đã nằm ở vị trí mới trong cây → gửi move cho nút được kéo,
   * rồi đánh lại thứ tự anh em (1..n) để tải lại vẫn giữ đúng thứ tự vừa kéo.
   */
  onDrop(event: NzFormatEmitEvent): void {
    const dragNode = event.dragNode;
    if (!dragNode) return;
    const parent = dragNode.getParentNode();
    const siblings: NzTreeNode[] = parent ? parent.getChildren() : (dragNode.treeService?.rootNodes ?? []);
    const parentId = parent ? String(parent.key) : '';

    const requests = siblings
      .map((node, index) => ({ node, order: index + 1 }))
      .filter(({ node, order }) => {
        const origin = node.origin['origin'] as OrganizationNode;
        return node.key === dragNode.key || origin.orderNumber !== order || (origin.pId || '') !== parentId;
      })
      .map(({ node, order }) => this.service.move(String(node.key), parentId, order));

    if (!requests.length) return;
    this.isMoving = true;
    concat(...requests)
      .pipe(last(), finalize(() => { this.isMoving = false; this.load(); }), takeUntil(this.destroy$))
      .subscribe(() => this.message.success('Đã di chuyển phòng ban'));
  }

  ngOnDestroy(): void {
    this.global.setBreadcrumb([]);
    this.destroy$.next();
    this.destroy$.complete();
  }
}


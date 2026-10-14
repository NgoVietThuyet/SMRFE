import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, finalize, takeUntil } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { GlobalService } from '../../../../core';
import { StringUtils } from '../../../../shared/utils';
import { TitleService } from '../../services/title.service';
import { Title, TitleDto } from '../../models/admin.models';

/** P2 — Chức danh (mẫu 2.FrontEnd master-data/title). BE trả toàn bộ danh sách → lọc, phân trang phía client. */
@Component({
  selector: 'app-titles',
  standalone: true,
  imports: [SharedModules],
  templateUrl: './titles.html',
  styleUrl: './titles.scss'
})
export class Titles implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  all: Title[] = [];
  keyword = '';
  statusFilter: boolean | null = null;
  pageIndex = 1;
  pageSize = 20;

  visible = false;
  isEdit = false;
  isSaving = false;
  dto: TitleDto = new TitleDto();
  codeError = '';

  constructor(
    private global: GlobalService,
    private service: TitleService,
    private message: NzMessageService,
  ) {
    this.global.setBreadcrumb([{ name: 'Chức danh', path: 'admin/titles' }]);
  }

  ngOnInit(): void {
    this.search();
  }

  search(): void {
    this.service.list()
      .pipe(takeUntil(this.destroy$))
      .subscribe(list => this.all = list ?? []);
  }

  get filtered(): Title[] {
    const keyword = StringUtils.normalizeSearch(this.keyword);
    return this.all.filter(t =>
      (this.statusFilter === null || t.isActive === this.statusFilter) &&
      (!keyword || StringUtils.normalizeSearch(`${t.code} ${t.name}`).includes(keyword)));
  }

  onKeydownSearch(event: KeyboardEvent): void {
    if (event.key === 'Enter') {
      this.pageIndex = 1;
    }
  }

  reset(): void {
    this.keyword = '';
    this.statusFilter = null;
    this.pageIndex = 1;
    this.search();
  }

  trackByCode(_: number, item: Title): string {
    return item.code;
  }

  open(item: Title | null): void {
    this.codeError = '';
    this.isEdit = !!item;
    this.dto = item
      ? { code: item.code, name: item.name, notes: item.notes ?? '', orderNumber: item.orderNumber, isActive: item.isActive }
      : { ...new TitleDto(), orderNumber: this.all.length + 1 };
    this.visible = true;
  }

  close(): void {
    this.visible = false;
  }

  save(): void {
    const code = this.dto.code?.trim();
    if (!code) {
      this.codeError = 'Vui lòng nhập mã chức danh';
      return;
    }
    if (!this.isEdit && this.all.some(t => t.code.toLowerCase() === code.toLowerCase())) {
      this.codeError = 'Mã chức danh đã tồn tại';
      return;
    }
    if (!this.dto.name?.trim()) {
      this.message.warning('Vui lòng nhập tên chức danh');
      return;
    }
    this.codeError = '';
    const body: TitleDto = { ...this.dto, code, name: this.dto.name.trim() };
    const request$ = this.isEdit ? this.service.update(code, body) : this.service.create(body);
    this.isSaving = true;
    request$
      .pipe(finalize(() => this.isSaving = false), takeUntil(this.destroy$))
      .subscribe(() => {
        this.message.success(this.isEdit ? 'Đã cập nhật chức danh' : 'Đã thêm chức danh');
        this.visible = false;
        this.search();
      });
  }

  remove(item: Title): void {
    this.service.delete(item.code)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.message.success('Đã xóa chức danh');
        this.search();
      });
  }

  ngOnDestroy(): void {
    this.global.setBreadcrumb([]);
    this.destroy$.next();
    this.destroy$.complete();
  }
}

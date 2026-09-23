import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzPaginationModule } from 'ng-zorro-antd/pagination';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService, NzModalModule } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { DirectoryService } from '../../../core/services/directory.service';
import { CustomIconComponent } from '../../../layout/shell/custom-icon/custom-icon.component';
import type { DirectoryTitle, TitleRequest } from '../../../core/models/directory.models';

@Component({
    selector: 'app-titles',
    templateUrl: './titles.html',
    styleUrl: './titles.scss',
    imports: [
        CommonModule,
        FormsModule,
        ReactiveFormsModule,
        NzButtonModule,
        NzDrawerModule,
        NzEmptyModule,
        NzFormModule,
        NzInputModule,
        NzModalModule,
        NzPaginationModule,
        NzSelectModule,
        NzSpinModule,
        NzSwitchModule,
        NzTableModule,
        NzTooltipModule,
        CustomIconComponent,
    ],
})
export class Titles implements OnInit {
    private readonly directory = inject(DirectoryService);
    private readonly fb = inject(FormBuilder);
    private readonly message = inject(NzMessageService);
    private readonly modal = inject(NzModalService);
    private readonly destroyRef = inject(DestroyRef);

    // Data
    titles = signal<DirectoryTitle[]>([]);
    loading = signal<boolean>(true);
    loadError = signal<string | null>(null);

    // Filters
    keyword = signal<string>('');
    statusFilter = signal<string>('all'); // all | active | inactive
    private readonly keyword$ = new Subject<string>();

    // Pagination
    page = signal<number>(1);
    pageSize = signal<number>(10);

    // Form drawer
    showForm = signal<boolean>(false);
    editingCode = signal<string | null>(null);
    saving = signal<boolean>(false);
    detailTitle = signal<DirectoryTitle | null>(null);

    form = this.fb.nonNullable.group({
        code: ['', [Validators.required, Validators.maxLength(20)]],
        name: ['', [Validators.required, Validators.maxLength(100)]],
        notes: [''],
        orderNumber: [0, [Validators.required]],
        isActive: [true],
    });

    // Computed filtered
    filtered = computed(() => {
        const kw = this.keyword().trim().toLowerCase();
        const status = this.statusFilter();
        return this.titles().filter((t) => {
            const matchKeyword = !kw || t.code.toLowerCase().includes(kw) || t.name.toLowerCase().includes(kw);
            const matchStatus = status === 'all' || (status === 'active' ? t.isActive : !t.isActive);
            return matchKeyword && matchStatus;
        });
    });

    total = computed(() => this.filtered().length);

    paged = computed(() => {
        const all = this.filtered();
        const p = this.page();
        const ps = this.pageSize();
        const start = (p - 1) * ps;
        return all.slice(start, start + ps);
    });

    statusLabel = (isActive: boolean): string => (isActive ? 'Hoạt động' : 'Ngưng hoạt động');
    statusClass = (isActive: boolean): string => (isActive ? 'active' : 'inactive');

    constructor() {
        this.keyword$
            .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed(this.destroyRef))
            .subscribe((v) => {
                this.keyword.set(v);
                this.page.set(1);
            });
    }

    ngOnInit(): void {
        this.load();
    }

    load(): void {
        this.loading.set(true);
        this.loadError.set(null);
        this.directory
            .titles()
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (list) => {
                    // sort by orderNumber
                    const sorted = [...(list ?? [])].sort((a, b) => a.orderNumber - b.orderNumber);
                    this.titles.set(sorted);
                    this.loading.set(false);
                },
                error: (err: Error) => {
                    this.loading.set(false);
                    this.loadError.set(err.message || 'Không thể tải danh sách chức danh.');
                },
            });
    }

    reload(): void {
        this.keyword.set('');
        this.statusFilter.set('all');
        this.page.set(1);
        this.load();
    }

    onKeywordInput(v: string): void {
        this.keyword$.next(v);
    }

    onStatusChange(v: string): void {
        this.statusFilter.set(v);
        this.page.set(1);
    }

    onPageChange(p: number): void {
        this.page.set(p);
    }

    onPageSizeChange(ps: number): void {
        this.pageSize.set(ps);
        this.page.set(1);
    }

    openCreate(): void {
        this.editingCode.set(null);
        this.form.reset({ code: '', name: '', notes: '', orderNumber: 0, isActive: true });
        this.form.controls.code.enable();
        this.showForm.set(true);
    }

    openTitleDetail(item: DirectoryTitle): void {
        this.detailTitle.set(item);
    }

    closeTitleDetail(): void {
        this.detailTitle.set(null);
    }

    openEdit(item: DirectoryTitle): void {
        this.closeTitleDetail();
        this.editingCode.set(item.code);
        this.form.setValue({
            code: item.code,
            name: item.name,
            notes: item.notes ?? '',
            orderNumber: item.orderNumber,
            isActive: item.isActive,
        });
        this.form.controls.code.disable();
        this.showForm.set(true);
    }

    closeForm(): void {
        this.showForm.set(false);
        this.editingCode.set(null);
        this.saving.set(false);
    }

    submitForm(): void {
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        const raw = this.form.getRawValue();
        const payload: TitleRequest = {
            code: raw.code.trim().toUpperCase(),
            name: raw.name.trim(),
            notes: raw.notes?.trim() ? raw.notes.trim() : null,
            orderNumber: Number(raw.orderNumber) || 0,
            isActive: !!raw.isActive,
        };
        if (!payload.code || !payload.name) {
            this.message.warning('Vui lòng nhập đầy đủ mã và tên chức danh.');
            return;
        }
        this.saving.set(true);
        const req$ = this.editingCode()
            ? this.directory.updateTitle(this.editingCode()!, payload)
            : this.directory.createTitle(payload);
        req$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
            next: () => {
                this.message.success(this.editingCode() ? 'Cập nhật chức danh thành công.' : 'Thêm chức danh thành công.');
                this.closeForm();
                this.load();
            },
            error: (err: Error) => {
                this.saving.set(false);
                this.message.error(err.message || 'Lưu chức danh thất bại.');
            },
        });
    }

    confirmDelete(item: DirectoryTitle): void {
        this.modal.confirm({
            nzTitle: `Xóa chức danh "${item.name}"?`,
            nzContent: item.employeeCount > 0 ? `Chức danh đang có ${item.employeeCount} nhân sự sử dụng, không thể xóa.` : 'Hành động này không thể hoàn tác.',
            nzOkText: 'Xóa',
            nzOkDanger: true,
            nzCancelText: 'Hủy',
            nzOkDisabled: item.employeeCount > 0,
            nzOnOk: () =>
                new Promise<void>((resolve, reject) => {
                    this.directory.deleteTitle(item.code).subscribe({
                        next: () => {
                            this.message.success('Đã xóa chức danh.');
                            this.load();
                            // adjust page if last item on page deleted
                            const totalAfter = this.total() - 1;
                            const maxPage = Math.max(1, Math.ceil(totalAfter / this.pageSize()));
                            if (this.page() > maxPage) this.page.set(maxPage);
                            resolve();
                        },
                        error: (err: Error) => {
                            this.message.error(err.message || 'Xóa thất bại.');
                            reject();
                        },
                    });
                }),
        });
    }
}

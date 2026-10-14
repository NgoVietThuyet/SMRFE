import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, finalize, takeUntil } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { GlobalService } from '../../../../core';
import { SystemService } from '../../services/system.service';
import { MinutesTemplate, REQUIRED_TEMPLATE_PLACEHOLDERS, SystemSettings } from '../../models/admin.models';

/** Gợi ý đuôi tệp cho ô chọn (vẫn gõ thêm được). Đuôi thực thi được BE chặn. */
const SUGGESTED_EXTENSIONS = [
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.png', '.jpg', '.jpeg', '.zip', '.mp4', '.mp3',
];

/** P7 — Cấu hình hệ thống (mẫu 2.FrontEnd system-manager/document-system). Không hiển thị bí mật. */
@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [SharedModules],
  templateUrl: './settings.html',
  styleUrl: './settings.scss'
})
export class Settings implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  readonly placeholders = REQUIRED_TEMPLATE_PLACEHOLDERS;
  extensionOptions = [...SUGGESTED_EXTENSIONS];
  settings: SystemSettings | null = null;
  private original = '';
  isSaving = false;

  templates: MinutesTemplate[] = [];
  isUploading = false;

  constructor(
    private global: GlobalService,
    private service: SystemService,
    private message: NzMessageService,
  ) {
    this.global.setBreadcrumb([{ name: 'Cấu hình hệ thống', path: 'admin/settings' }]);
  }

  ngOnInit(): void {
    this.loadSettings();
    this.loadTemplates();
  }

  loadSettings(): void {
    this.service.settings()
      .pipe(takeUntil(this.destroy$))
      .subscribe(s => {
        this.settings = { ...s, allowedExtensions: [...(s.allowedExtensions ?? [])] };
        this.original = JSON.stringify(this.settings);
        const extra = this.settings.allowedExtensions.filter(e => !this.extensionOptions.includes(e));
        this.extensionOptions = [...this.extensionOptions, ...extra];
      });
  }

  get isDirty(): boolean {
    return !!this.settings && JSON.stringify(this.settings) !== this.original;
  }

  save(): void {
    const s = this.settings;
    if (!s) return;
    if (!s.allowedExtensions.length) {
      this.message.warning('Phải chọn ít nhất một loại tệp');
      return;
    }
    this.isSaving = true;
    this.service.saveSettings(s)
      .pipe(finalize(() => this.isSaving = false), takeUntil(this.destroy$))
      .subscribe(() => {
        this.message.success('Đã lưu cấu hình');
        this.loadSettings();
        this.loadTemplates();
      });
  }

  discard(): void {
    if (this.original) {
      this.settings = JSON.parse(this.original);
    }
  }

  // ───────────────────────── Mẫu biên bản ─────────────────────────

  loadTemplates(): void {
    this.service.templates()
      .pipe(takeUntil(this.destroy$))
      .subscribe(list => this.templates = list ?? []);
  }

  /** nz-upload: chặn upload tự động, kiểm tra sơ bộ rồi tự gửi qua CommonService (có token). */
  beforeUpload = (file: any): boolean => {
    const raw = file as File;
    if (!raw.name.toLowerCase().endsWith('.docx')) {
      this.message.warning('Mẫu biên bản phải là file .docx');
      return false;
    }
    if (raw.size > 10 * 1024 * 1024) {
      this.message.warning('Mẫu biên bản không vượt quá 10 MB');
      return false;
    }
    this.isUploading = true;
    this.service.uploadTemplate(raw)
      .pipe(finalize(() => this.isUploading = false), takeUntil(this.destroy$))
      .subscribe(() => {
        this.message.success('Đã tải lên mẫu biên bản');
        this.loadTemplates();
        this.loadSettings();
      });
    return false;
  };

  setDefault(t: MinutesTemplate): void {
    this.service.setDefaultTemplate(t.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.message.success(`Đã đặt "${t.fileName}" làm mẫu mặc định`);
        this.loadTemplates();
        this.loadSettings();
      });
  }

  remove(t: MinutesTemplate): void {
    this.service.deleteTemplate(t.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.message.success('Đã xóa mẫu biên bản');
        this.loadTemplates();
      });
  }

  download(t: MinutesTemplate): void {
    this.service.templateDownloadUrl(t.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(res => {
        if (res?.url) window.open(res.url, '_blank', 'noopener');
      });
  }

  createdAt(t: MinutesTemplate): Date | null {
    return SystemService.fromUtcLocal(t.createDate);
  }

  fileSize(bytes: number): string {
    if (!bytes) return '0 KB';
    return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.ceil(bytes / 1024)} KB`;
  }

  ngOnDestroy(): void {
    this.global.setBreadcrumb([]);
    this.destroy$.next();
    this.destroy$.complete();
  }
}

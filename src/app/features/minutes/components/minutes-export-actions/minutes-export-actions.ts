import { Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { finalize } from 'rxjs';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { DateTimeUtils } from '../../../../shared/utils';
import { MinutesTemplateInfo } from '../../models/minutes.models';
import { MinutesExportService } from '../../services/minutes-export.service';
import { MinutesService } from '../../services/minutes.service';

const MAX_BYTES = 10 * 1024 * 1024;

/**
 * Hai nút của biên bản (mọi thành viên cuộc họp):
 * [Tải mẫu lên] chỉ lưu mẫu (.docx / .pdf, mẫu sau thay mẫu trước) · [Tải biên bản họp] chạy job ngầm, xong tự tải về máy.
 */
@Component({
  selector: 'app-minutes-export-actions',
  standalone: true,
  imports: [SharedModules],
  template: `
    <input #fileInput type="file" hidden accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      (change)="onFile($event)" />
    <nz-space nzWrap>
      <button *nzSpaceItem nz-button [nzLoading]="uploading" (click)="fileInput.click()"
        nz-tooltip nzTooltipTitle="Mẫu biên bản của đơn vị (.docx hoặc .pdf, tối đa 10 MB). Chỉ lưu mẫu, chưa tổng hợp.">
        <nz-icon nzType="upload" /> Tải mẫu lên
      </button>
      <button *nzSpaceItem nz-button nzType="primary" [nzLoading]="exports.isPending(meetingId)" (click)="download()"
        nz-tooltip nzTooltipTitle="Tổng hợp biên bản theo mẫu ở chế độ chạy ngầm; xong sẽ tự tải về máy">
        <nz-icon nzType="download" /> {{ exports.isPending(meetingId) ? 'Đang tổng hợp…' : 'Tải biên bản họp' }}
      </button>
      @if (template) {
      <span *nzSpaceItem class="tpl" [title]="sectionsHint">
        <nz-icon [nzType]="template.format === 'PDF' ? 'file-pdf' : 'file-word'" />
        @if (template.source === 'MEETING') {
          Mẫu: <b>{{ template.fileName }}</b>
          <span class="muted">· {{ template.uploadedByName }} · {{ when(template.uploadedAt) }}</span>
          @if (template.canDelete) {
          <a class="del" aria-label="Xóa mẫu" nz-popconfirm nzPopconfirmTitle="Xóa mẫu này? Biên bản sẽ dùng mẫu mặc định."
            (nzOnConfirm)="remove()"><nz-icon nzType="delete" /></a>
          }
        } @else {
          <span class="muted">Mẫu: {{ template.fileName }}</span>
        }
      </span>
      }
    </nz-space>
  `,
  styles: [`
    .tpl { font-size: 13px; display: inline-flex; align-items: center; gap: 4px; max-width: 420px; }
    .tpl b { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px; display: inline-block; vertical-align: bottom; }
    .muted { color: rgba(0, 0, 0, 0.45); }
    .del { color: rgba(0, 0, 0, 0.45); margin-left: 4px; }
    .del:hover { color: #ff4d4f; }
  `],
})
export class MinutesExportActions implements OnChanges {
  @Input({ required: true }) meetingId!: string;
  @Input() meetingName = '';
  @ViewChild('fileInput') private fileInput?: ElementRef<HTMLInputElement>;

  template: MinutesTemplateInfo | null = null;
  uploading = false;

  constructor(
    private service: MinutesService,
    readonly exports: MinutesExportService,
    private message: NzMessageService,
    private modal: NzModalService,
  ) { }

  ngOnChanges(): void {
    if (this.meetingId) this.loadTemplate();
  }

  private loadTemplate(): void {
    this.service.template(this.meetingId).subscribe({ next: t => this.template = t, error: () => this.template = null });
  }

  get sectionsHint(): string {
    const s = this.template?.sections ?? [];
    return s.length ? 'Các mục nhận ra trong mẫu: ' + s.join(' · ') : '';
  }

  onFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith('.doc')) {
      this.message.warning('Chưa hỗ trợ file .doc (Word cũ). Hãy mở bằng Word và lưu lại thành .docx.');
      return;
    }
    if (!name.endsWith('.docx') && !name.endsWith('.pdf')) {
      this.message.warning('Mẫu biên bản phải là file .docx hoặc .pdf.');
      return;
    }
    if (file.size > MAX_BYTES) {
      this.message.warning('Mẫu biên bản không vượt quá 10 MB.');
      return;
    }
    const upload = () => {
      this.uploading = true;
      this.service.uploadTemplate(this.meetingId, file).pipe(finalize(() => this.uploading = false)).subscribe(t => {
        this.template = t;
        if (t.sections.length) this.message.info(`Đã nhận ra ${t.sections.length} mục trong mẫu.`);
      });
    };
    if (this.template?.source === 'MEETING') {
      this.modal.confirm({
        nzTitle: 'Thay mẫu biên bản?',
        nzContent: `Cuộc họp đang dùng mẫu "${this.template.fileName}". Mẫu mới sẽ thay thế mẫu này.`,
        nzOkText: 'Thay mẫu', nzCancelText: 'Hủy', nzOnOk: upload,
      });
    } else {
      upload();
    }
  }

  remove(): void {
    this.service.deleteTemplate(this.meetingId).subscribe(() => {
      this.message.success('Đã xóa mẫu của cuộc họp.');
      this.loadTemplate();
    });
  }

  download(): void {
    this.exports.request(this.meetingId, this.meetingName);
  }

  when(utc: string | null): string {
    const d = DateTimeUtils.fromUtc(utc);
    if (!d) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  }
}

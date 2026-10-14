import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subject, debounceTime, filter, takeUntil } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { SharedModules } from '../../../../../shared/ng-zorro.module';
import { GlobalService } from '../../../../../core';
import { RealtimeHubService } from '../../../../../shared/services';
import { DateTimeUtils, FileUtils } from '../../../../../shared/utils';
import { UPLOAD_MAX_BYTES, validateClientFile } from '../../../../../shared/utils/file-upload-guard';
import { MeetingFile } from '../../../models/meeting.models';
import { MeetingService } from '../../../services/meeting.service';

/** Panel Tài liệu trong phòng: xem / tải xuống; tải lên khi chủ trì bật "Tải tài liệu lên trong phòng". */
@Component({
  selector: 'app-room-files-panel',
  standalone: true,
  imports: [SharedModules],
  template: `
    @if (canUpload) {
    <button nz-button nzType="dashed" nzBlock [nzLoading]="uploading" (click)="input.click()" class="upload">
      <nz-icon nzType="upload" /> Tải tài liệu lên
    </button>
    <input #input type="file" hidden multiple (change)="picked($event)" />
    }
    @if (!loaded) { <nz-spin nzSimple class="spin"></nz-spin> }
    @else if (!files.length) { <nz-empty nzNotFoundContent="Chưa có tài liệu"></nz-empty> }
    @for (f of files; track f.id) {
    <div class="file">
      <img class="icon" [src]="icon(f)" alt="" />
      <div class="main">
        <div class="name" [title]="f.fileName">{{ f.fileName }}</div>
        <div class="muted">{{ size(f.fileSize) }} · {{ time(f.createDate) | date: 'HH:mm dd/MM' }}</div>
      </div>
      <button nz-button nzType="text" nzSize="small" (click)="download(f)" aria-label="Tải xuống"><nz-icon nzType="download" /></button>
    </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .upload { margin-bottom: 8px; }
    .spin { display: block; margin: 24px auto; }
    .file { display: flex; align-items: center; gap: 8px; padding: 6px 4px; border-bottom: 1px solid #f5f5f5; }
    .icon { width: 28px; height: 28px; object-fit: contain; }
    .main { flex: 1; min-width: 0; }
    .name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .muted { color: #8c8c8c; font-size: 12px; }
  `],
})
export class RoomFilesPanel implements OnInit, OnDestroy {
  @Input({ required: true }) meetingId = '';
  @Input() canUpload = false;

  private destroy$ = new Subject<void>();
  files: MeetingFile[] = [];
  loaded = false;
  uploading = false;

  constructor(
    private meetings: MeetingService,
    private hub: RealtimeHubService,
    private global: GlobalService,
    private message: NzMessageService,
  ) { }

  ngOnInit(): void {
    this.load();
    this.hub.roomEvent
      .pipe(filter(e => e.name === 'FilesChanged' && e.payload?.meetingId === this.meetingId), debounceTime(300), takeUntil(this.destroy$))
      .subscribe(() => this.load());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.meetings.files(this.meetingId).pipe(takeUntil(this.destroy$)).subscribe({
      next: list => {
        this.files = [...(list ?? [])].sort((a, b) => (b.createDate ?? '').localeCompare(a.createDate ?? ''));
        this.loaded = true;
      },
      error: () => this.loaded = true,
    });
  }

  picked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const queue = Array.from(input.files ?? []);
    input.value = '';
    this.next(queue);
  }

  private next(queue: File[]): void {
    const file = queue.shift();
    if (!file) {
      this.uploading = false;
      return;
    }
    const error = validateClientFile(file, UPLOAD_MAX_BYTES.explorer);
    if (error) {
      this.message.warning(`${file.name}: ${error}`);
      this.next(queue);
      return;
    }
    this.uploading = true;
    this.meetings.uploadFile(this.meetingId, file).subscribe({
      next: () => this.next(queue),
      error: () => this.next(queue),
    });
  }

  download(f: MeetingFile): void {
    this.meetings.downloadUrl(f.id).subscribe(res => {
      if (res?.url) window.open(res.url, '_blank', 'noopener');
    });
  }

  icon(f: MeetingFile): string {
    return this.global.getFileIcon(f.mimeType);
  }

  size(bytes: number): string {
    return FileUtils.getHumanFileSize(Number(bytes) || 0, 1);
  }

  time(v: string): Date | null {
    return DateTimeUtils.fromUtc(v);
  }
}

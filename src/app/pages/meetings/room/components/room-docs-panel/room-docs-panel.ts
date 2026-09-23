import { Component, DestroyRef, ElementRef, inject, input, OnInit, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { MeetingService } from '../../../../../core/services/meeting.service';
import { MeetingHubService } from '../../../../../core/services/meeting-hub.service';
import { MeetingFileDto } from '../../../../../core/models/meeting.models';
import { RoomKey, RoomLang, ROOM_I18N } from '../../room-i18n';

// =====================================================
// RoomDocsPanel — tài liệu cuộc họp trong Meeting Room.
// List (bỏ Type=2 recording) + Mở/Tải xuống + Tải lên qua
// POST /api/File/Meetings/{id}/files (BE giới hạn member).
// =====================================================
@Component({
    selector: 'app-room-docs-panel',
    templateUrl: './room-docs-panel.html',
    imports: [
        CommonModule,
        FormsModule,
        NzButtonModule,
        NzEmptyModule,
        NzIconModule,
        NzInputModule,
        NzSpinModule,
    ],
})
export class RoomDocsPanel implements OnInit {
    private readonly meetingService = inject(MeetingService);
    private readonly hub = inject(MeetingHubService);
    private readonly message = inject(NzMessageService);
    private readonly destroyRef = inject(DestroyRef);

    private static readonly ALLOWED_EXT = new Set([
        '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.png', '.jpg', '.jpeg', '.zip'
    ]);
    private static readonly MAX_DOC_SIZE = 200 * 1024 * 1024;

    private readonly fileInput = viewChild.required<ElementRef<HTMLInputElement>>('fileInput');

    meetingId = input.required<string>();
    lang = input<RoomLang>('vi');

    files = signal<MeetingFileDto[]>([]);
    loading = signal<boolean>(true);
    loadError = signal<boolean>(false);
    keyword = signal<string>('');
    uploading = signal<boolean>(false);

    t(key: RoomKey): string {
        return ROOM_I18N[this.lang()][key];
    }

    ngOnInit(): void {
        this.load();
        this.hub.filesChanged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((e) => {
            if (e.meetingId === this.meetingId()) this.load();
        });
    }

    load(): void {
        this.loading.set(true);
        this.loadError.set(false);
        this.meetingService
            .getFiles(this.meetingId())
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (files) => {
                    this.files.set((files ?? []).filter((f) => f.type !== 2));
                    this.loading.set(false);
                },
                error: () => {
                    this.loading.set(false);
                    this.loadError.set(true);
                },
            });
    }

    filtered(): MeetingFileDto[] {
        const q = this.keyword().trim().toLowerCase();
        const docs = this.files();
        if (!q) return docs;
        return docs.filter((f) => f.fileName.toLowerCase().includes(q));
    }

    pickFile(): void {
        this.fileInput().nativeElement.click();
    }

    onFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];
        input.value = '';
        if (!file) return;
        const ext = '.' + (file.name.split('.').pop()?.toLowerCase() ?? '');
        if (!RoomDocsPanel.ALLOWED_EXT.has(ext)) {
            this.message.error(`Định dạng ${ext} không được hỗ trợ.`);
            return;
        }
        if (file.size > RoomDocsPanel.MAX_DOC_SIZE) {
            this.message.error('File vượt quá 200MB.');
            return;
        }
        this.uploading.set(true);
        this.meetingService
            .uploadMeetingFile(this.meetingId(), file)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.uploading.set(false);
                    this.message.success(this.t('uploadOk'));
                    this.load();
                },
                error: (err: Error) => {
                    this.uploading.set(false);
                    this.message.error(err.message || this.t('uploadFailed'));
                },
            });
    }

    openFile(file: MeetingFileDto): void {
        this.meetingService
            .downloadUrl(file.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({ next: (url) => window.open(url, '_blank', 'noopener') });
    }

    downloadFile(file: MeetingFileDto): void {
        this.meetingService
            .downloadUrl(file.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (url) => {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = file.fileName;
                    a.rel = 'noopener';
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                },
            });
    }

    iconFor(fileName: string, mimeType: string): string {
        const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
        if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) || mimeType.startsWith('image/')) {
            return 'picture';
        }
        if (['pdf'].includes(ext)) return 'file-pdf';
        if (['doc', 'docx'].includes(ext)) return 'file-word';
        if (['xls', 'xlsx', 'csv'].includes(ext)) return 'file-excel';
        if (['ppt', 'pptx'].includes(ext)) return 'file-ppt';
        if (['zip', 'rar', '7z'].includes(ext)) return 'file-zip';
        return 'file';
    }

    formatSize(bytes: number): string {
        if (!bytes || bytes <= 0) return '—';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
        return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    }
}

import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzTableModule } from 'ng-zorro-antd/table';
import { MeetingService } from '../../../../../core/services/meeting.service';
import { MeetingFileDto } from '../../../../../core/models/meeting.models';

// =====================================================
// DocsTab — tài liệu cuộc họp (GET GetMeetingFiles).
// BE chưa có upload-tài-liệu/xóa-file nên chỉ Mở/Tải xuống.
// Bỏ qua Type=2 (recording, xem ở tab Ghi hình).
// =====================================================
@Component({
    selector: 'app-docs-tab',
    templateUrl: './docs-tab.html',
    styleUrl: './docs-tab.scss',
    imports: [
        FormsModule,
        NzButtonModule,
        NzDropdownModule,
        NzEmptyModule,
        NzIconModule,
        NzInputModule,
        NzMenuModule,
        NzTableModule,
    ],
})
export class DocsTab implements OnInit {
    private readonly meetingService = inject(MeetingService);
    private readonly destroyRef = inject(DestroyRef);

    meetingId = input.required<string>();

    files = signal<MeetingFileDto[]>([]);
    loading = signal<boolean>(true);
    loadError = signal<string | null>(null);
    keyword = signal<string>('');

    filtered = (): MeetingFileDto[] => {
        const q = this.keyword().trim().toLowerCase();
        const docs = this.files().filter((f) => f.type !== 2);
        if (!q) return docs;
        return docs.filter((f) => f.fileName.toLowerCase().includes(q));
    };

    ngOnInit(): void {
        this.load();
    }

    load(): void {
        this.loading.set(true);
        this.loadError.set(null);
        this.meetingService
            .getFiles(this.meetingId())
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (files) => {
                    this.files.set(files);
                    this.loading.set(false);
                },
                error: (err: Error) => {
                    this.loading.set(false);
                    this.loadError.set(err.message || 'Không thể tải danh sách tài liệu.');
                },
            });
    }

    iconFor(fileName: string, mimeType: string): string {
        const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
        if (['mp4', 'webm', 'mkv'].includes(ext) || mimeType.startsWith('video/')) {
            return 'video-camera';
        }
        if (['mp3', 'wav', 'ogg'].includes(ext) || mimeType.startsWith('audio/')) return 'audio';
        return 'file';
    }

    formatSize(bytes: number): string {
        if (!bytes || bytes <= 0) return '—';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
        return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
    }

    formatDate(iso: string): string {
        if (!iso) return '—';
        const d = new Date(iso);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        return `${day}/${month}/${d.getFullYear()} ${time}`;
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
            .subscribe({ next: (url) => {
                const a = document.createElement('a');
                a.href = url;
                a.download = file.fileName;
                a.rel = 'noopener';
                document.body.appendChild(a);
                a.click();
                a.remove();
            } });
    }
}

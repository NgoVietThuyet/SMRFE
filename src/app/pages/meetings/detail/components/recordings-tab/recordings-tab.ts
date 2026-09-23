import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { MeetingService } from '../../../../../core/services/meeting.service';
import { MeetingFileDto } from '../../../../../core/models/meeting.models';

// =====================================================
// RecordingsTab — bản ghi video (CmFile Type=2, Jibri).
// Sắp xếp theo thời gian upload; link ký 900s nên lấy
// url khi chọn segment. BE không trả duration → không hiện.
// =====================================================
@Component({
    selector: 'app-recordings-tab',
    templateUrl: './recordings-tab.html',
    styleUrl: './recordings-tab.scss',
    imports: [NzButtonModule, NzEmptyModule, NzIconModule],
})
export class RecordingsTab implements OnInit {
    private readonly meetingService = inject(MeetingService);
    private readonly destroyRef = inject(DestroyRef);

    meetingId = input.required<string>();

    segments = signal<MeetingFileDto[]>([]);
    loading = signal<boolean>(true);
    loadError = signal<string | null>(null);
    selectedId = signal<string | null>(null);
    playUrl = signal<string | null>(null);
    loadingUrl = signal<boolean>(false);

    selected = (): MeetingFileDto | null =>
        this.segments().find((s) => s.id === this.selectedId()) ?? null;

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
                    const segs = files
                        .filter((f) => f.type === 2)
                        .sort(
                            (a, b) =>
                                new Date(a.createDate).getTime() - new Date(b.createDate).getTime()
                        );
                    this.segments.set(segs);
                    this.loading.set(false);
                    if (segs.length > 0 && !this.selectedId()) this.select(segs[0]);
                },
                error: (err: Error) => {
                    this.loading.set(false);
                    this.loadError.set(err.message || 'Không thể tải danh sách bản ghi.');
                },
            });
    }

    select(segment: MeetingFileDto): void {
        if (this.selectedId() === segment.id && this.playUrl()) return;
        this.selectedId.set(segment.id);
        this.playUrl.set(null);
        this.loadingUrl.set(true);
        this.meetingService
            .downloadUrl(segment.id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (url) => {
                    this.playUrl.set(url);
                    this.loadingUrl.set(false);
                },
                error: () => this.loadingUrl.set(false),
            });
    }

    formatDate(iso: string): string {
        if (!iso) return '—';
        const d = new Date(iso);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        return `${day}/${month}/${d.getFullYear()} · ${time}`;
    }
}

import { Injectable, signal } from '@angular/core';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { Subscription, filter, interval } from 'rxjs';
import { RealtimeHubService } from '../../../shared/services';
import { JobStatus, MinutesExport } from '../models/minutes.models';
import { MinutesService, saveBlob } from './minutes.service';

interface PendingExport {
    id: string;
    meetingId: string;
    meetingName: string;
}

const STORAGE_KEY = 'smr.minutesExports';
const POLL_MS = 5000;

/**
 * "Tải biên bản họp" chạy ngầm (P13 bổ sung). Dịch vụ dùng chung cho cả ứng dụng (khởi tạo ở khung chính):
 * giữ các job đang chờ, nghe sự kiện realtime `MinutesExportReady` và hỏi lại định kỳ để dự phòng.
 * Job xong → tự tải file về máy + báo thành công. Danh sách job lưu ở localStorage nên tải lại trang vẫn tiếp tục chờ.
 */
@Injectable({ providedIn: 'root' })
export class MinutesExportService {
    /** Số job đang chờ (cho chỉ báo ở khung chính). */
    readonly pending = signal<PendingExport[]>([]);

    private started = false;
    private poll: Subscription | null = null;
    private finishing = new Set<string>();

    constructor(private service: MinutesService, private hub: RealtimeHubService, private notify: NzNotificationService) { }

    /** Gọi một lần khi vào khung chính: khôi phục job đang chờ và bắt đầu lắng nghe. */
    start(): void {
        if (this.started) return;
        this.started = true;
        this.pending.set(this.load());
        this.hub.roomEvent.pipe(filter(e => e.name === 'MinutesExportReady')).subscribe(e => {
            const id = e.payload?.exportId as string | undefined;
            if (id && this.pending().some(p => p.id === id)) this.check(id);
        });
        this.syncPolling();
        this.pending().forEach(p => this.check(p.id));
    }

    /** Bấm "Tải biên bản họp": tạo job, trả lời ngay; file tự tải về khi xong. */
    request(meetingId: string, meetingName: string): void {
        if (this.pending().some(p => p.meetingId === meetingId)) {
            this.notify.info('Đang tổng hợp biên bản', `Biên bản "${meetingName}" đang được tổng hợp, file sẽ tự tải về khi xong.`);
            return;
        }
        this.service.requestExport(meetingId).subscribe(job => {
            if (job.status === JobStatus.Done) {
                // Dữ liệu chưa đổi → dùng lại file đã dựng, tải ngay.
                this.finish({ id: job.id, meetingId, meetingName: job.meetingName || meetingName });
                return;
            }
            this.add({ id: job.id, meetingId, meetingName: job.meetingName || meetingName });
            this.notify.info('Đang tổng hợp biên bản',
                'Bạn có thể tiếp tục làm việc. File sẽ tự tải về máy khi tổng hợp xong.', { nzDuration: 5000 });
        });
    }

    /** Tải lại file của một job đã xong (từ chuông thông báo). */
    downloadAgain(exportId: string, meetingName: string): void {
        this.service.exportFile(exportId, this.fileName(meetingName)).subscribe(({ blob, fileName }) => saveBlob(blob, fileName));
    }

    isPending(meetingId: string): boolean {
        return this.pending().some(p => p.meetingId === meetingId);
    }

    private check(id: string): void {
        if (this.finishing.has(id)) return;
        this.service.exportStatus(id).subscribe({
            next: job => this.onStatus(job),
            error: err => {
                // Job không còn / mất quyền → bỏ khỏi danh sách để không hỏi mãi.
                if (err?.status === 403 || err?.status === 404) this.remove(id);
            },
        });
    }

    private onStatus(job: MinutesExport): void {
        const item = this.pending().find(p => p.id === job.id);
        if (!item) return;
        if (job.status === JobStatus.Done) {
            this.finish(item);
        } else if (job.status === JobStatus.Failed) {
            this.remove(item.id);
            this.notify.error('Không tổng hợp được biên bản', `${item.meetingName}: ${job.error || 'lỗi không xác định'}. Hãy thử lại.`,
                { nzDuration: 0 });
        }
    }

    private finish(item: PendingExport): void {
        if (this.finishing.has(item.id)) return;
        this.finishing.add(item.id);
        this.service.exportFile(item.id, this.fileName(item.meetingName)).subscribe({
            next: ({ blob, fileName }) => {
                saveBlob(blob, fileName);
                this.remove(item.id);
                this.finishing.delete(item.id);
                this.notify.success('Đã tải biên bản họp', `${fileName} đã được tải về máy của bạn.`);
            },
            error: () => {
                this.finishing.delete(item.id);
                this.remove(item.id);
                this.notify.error('Không tải được file biên bản', 'Hãy tải lại từ thông báo hoặc bấm "Tải biên bản họp" lần nữa.');
            },
        });
    }

    private add(item: PendingExport): void {
        this.pending.set([...this.pending().filter(p => p.id !== item.id), item]);
        this.save();
        this.syncPolling();
    }

    private remove(id: string): void {
        this.pending.set(this.pending().filter(p => p.id !== id));
        this.save();
        this.syncPolling();
    }

    /** Hỏi lại định kỳ chỉ khi còn job chờ (dự phòng khi mất realtime). */
    private syncPolling(): void {
        if (this.pending().length && !this.poll) {
            this.poll = interval(POLL_MS).subscribe(() => this.pending().forEach(p => this.check(p.id)));
        } else if (!this.pending().length && this.poll) {
            this.poll.unsubscribe();
            this.poll = null;
        }
    }

    private fileName(meetingName: string): string {
        return `BienBan_${(meetingName || 'CuocHop').replace(/[\\/:*?"<>|]+/g, '_')}.docx`;
    }

    private load(): PendingExport[] {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const list = raw ? JSON.parse(raw) : [];
            return Array.isArray(list) ? list.filter(x => x && typeof x.id === 'string') : [];
        } catch {
            return [];
        }
    }

    private save(): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(this.pending()));
        } catch { /* trình duyệt chặn bộ nhớ → vẫn chạy trong phiên hiện tại */ }
    }
}

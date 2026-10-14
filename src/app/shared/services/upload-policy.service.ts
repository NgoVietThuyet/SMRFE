import { Injectable, signal } from '@angular/core';
import { CommonService } from './common.service';
import { hasBlockedExtension, getFileExtension } from '../utils/file-upload-guard';

/** PublicSettingsResponse — GET /api/settings/public (P7). */
export interface UploadPolicy {
    maxUploadSizeMb: number;
    allowedExtensions: string[];
}

const DEFAULT_POLICY: UploadPolicy = {
    maxUploadSizeMb: 200,
    allowedExtensions: ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.png', '.jpg', '.jpeg', '.zip'],
};

/**
 * Giới hạn tải tài liệu theo Cấu hình hệ thống (P7): dung lượng tối đa + đuôi file cho phép.
 * Đọc `settings/public` một lần (lỗi → giá trị mặc định); BE vẫn kiểm tra lại khi nhận file.
 * Dùng cho tài liệu cuộc họp (chi tiết cuộc họp, phòng họp) và đính kèm công việc.
 */
@Injectable({ providedIn: 'root' })
export class UploadPolicyService {
    readonly policy = signal<UploadPolicy>(DEFAULT_POLICY);
    private loaded = false;

    constructor(private common: CommonService) {
        this.refresh();
    }

    /** Đọc lại cấu hình (gọi sau khi Admin lưu Cấu hình hệ thống). */
    refresh(): void {
        this.common.get<UploadPolicy>('settings/public', null, false).subscribe({
            next: p => {
                if (!p) return;
                this.loaded = true;
                this.policy.set({
                    maxUploadSizeMb: p.maxUploadSizeMb > 0 ? p.maxUploadSizeMb : DEFAULT_POLICY.maxUploadSizeMb,
                    allowedExtensions: p.allowedExtensions?.length
                        ? p.allowedExtensions.map(e => (e.startsWith('.') ? e : '.' + e).toLowerCase())
                        : DEFAULT_POLICY.allowedExtensions,
                });
            },
            error: () => { /* giữ mặc định */ },
        });
    }

    /** Thông báo lỗi tiếng Việt, hoặc null nếu file hợp lệ. */
    check(file: File): string | null {
        const p = this.policy();
        if (!file || file.size <= 0) return 'File rỗng hoặc không hợp lệ';
        if (file.size > p.maxUploadSizeMb * 1024 * 1024) return `File vượt quá ${p.maxUploadSizeMb}MB`;
        if (hasBlockedExtension(file.name)) return 'Loại file không được phép';
        const ext = getFileExtension(file.name);
        if (!p.allowedExtensions.includes(ext)) return `Định dạng ${ext || '(không có)'} không được phép`;
        return null;
    }

    /** Giá trị cho thuộc tính accept của <input type="file">. */
    get accept(): string {
        return this.policy().allowedExtensions.join(',');
    }

    /** Dòng gợi ý dưới nút tải lên. */
    get hint(): string {
        const p = this.policy();
        return `Tối đa ${p.maxUploadSizeMb}MB mỗi file · ${p.allowedExtensions.map(e => e.slice(1)).join(', ')}`;
    }

    get isLoaded(): boolean {
        return this.loaded;
    }
}

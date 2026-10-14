import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { CommonService, PagedResult } from '../../../shared/services';
import { PaginationResult } from '../../../shared/models';
import { DateTimeUtils } from '../../../shared/utils';
import {
    AuditLog, AuditLogFilter, HumanResourceSummary, MeetingReport, MinutesTemplate, SystemSettings, TaskReport,
} from '../models/admin.models';

/** Thống kê (P5), Nhật ký (P6), Cấu hình (P7) — /api/admin/** chỉ Admin. */
@Injectable({
    providedIn: 'root',
})
export class SystemService {
    constructor(private common: CommonService) { }

    // ── P5 ──
    hrSummary(): Observable<HumanResourceSummary> { return this.common.get<HumanResourceSummary>('human-resources/summary', null, false) }

    meetingReport(from: string, to: string, organizationId: string | null): Observable<MeetingReport> { return this.common.get<MeetingReport>('admin/reports/meetings', { from, to, organizationId }) }

    taskReport(from: string, to: string): Observable<TaskReport> { return this.common.get<TaskReport>('admin/reports/tasks', { from, to }, false) }

    // ── P6 ──
    auditLogs(filter: AuditLogFilter): Observable<PaginationResult> {
        const params = {
            ...filter,
            from: filter.from ? SystemService.toUtcLocal(filter.from) : null,
            to: filter.to ? SystemService.toUtcLocal(filter.to) : null,
        };
        return this.common.get<PagedResult<AuditLog>>('admin/audit-logs', params).pipe(map(res => this.common.toPagination(res)));
    }

    // ── P7 ──
    settings(): Observable<SystemSettings> { return this.common.get<SystemSettings>('admin/settings') }

    saveSettings(data: SystemSettings) { return this.common.put('admin/settings', data) }

    templates(): Observable<MinutesTemplate[]> { return this.common.get<MinutesTemplate[]>('admin/minutes-templates', null, false) }

    uploadTemplate(file: File) { return this.common.uploadFiles('admin/minutes-templates', [file], 'file') }

    setDefaultTemplate(id: string) { return this.common.put(`admin/minutes-templates/${encodeURIComponent(id)}/default`, {}) }

    deleteTemplate(id: string) { return this.common.delete(`admin/minutes-templates/${encodeURIComponent(id)}`) }

    templateDownloadUrl(id: string): Observable<{ url: string; expiresIn: number }> { return this.common.get(`admin/minutes-templates/${encodeURIComponent(id)}/download`) }

    /** BE lưu thời gian UTC không kèm múi giờ (LocalDateTime) → gửi ISO UTC bỏ chữ Z. */
    static toUtcLocal(date: Date): string {
        return date.toISOString().replace('Z', '');
    }

    /** Hiển thị: chuỗi LocalDateTime UTC từ BE → Date theo giờ máy. */
    static fromUtcLocal(value: string | null | undefined): Date | null {
        return DateTimeUtils.fromUtc(value);
    }
}

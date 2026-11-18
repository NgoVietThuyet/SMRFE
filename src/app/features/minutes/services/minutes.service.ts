import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiResponse, CommonService, PagedResult } from '../../../shared/services';
import {
    MinutesContent, MinutesDetail, MinutesExport, MinutesJob, MinutesListItem, MinutesTemplateInfo, MinutesVersion, TranscriptSegment,
} from '../models/minutes.models';

/** API biên bản (P13): /api/minutes, /api/Meeting/{id}/minutes/**, /api/Meeting/{id}/transcripts. */
@Injectable({
    providedIn: 'root',
})
export class MinutesService {
    constructor(private common: CommonService) { }

    private base(id: string): string {
        return `Meeting/${encodeURIComponent(id)}`;
    }

    list(keyword: string, page: number, pageSize: number): Observable<PagedResult<MinutesListItem>> {
        return this.common.get<PagedResult<MinutesListItem>>('minutes', { keyword, page, pageSize }, false);
    }

    detail(meetingId: string, version?: number | null): Observable<MinutesDetail> {
        return this.common.get<MinutesDetail>(`${this.base(meetingId)}/minutes`, version ? { version } : null, false);
    }

    transcripts(meetingId: string): Observable<TranscriptSegment[]> {
        return this.common.get<TranscriptSegment[]>(`${this.base(meetingId)}/transcripts`, null, false);
    }

    updateSegment(meetingId: string, segmentId: string, text: string | null, speakerName: string | null): Observable<TranscriptSegment> {
        return this.common.put<ApiResponse<TranscriptSegment>>(`${this.base(meetingId)}/transcripts/${encodeURIComponent(segmentId)}`,
            { text, speakerName }, false, false).pipe(map(r => r.data));
    }

    generate(meetingId: string): Observable<MinutesJob> {
        return this.common.post<ApiResponse<MinutesJob>>(`${this.base(meetingId)}/minutes/generate`, null, false, false).pipe(map(r => r.data));
    }

    newDraft(meetingId: string): Observable<MinutesVersion> {
        return this.common.post<ApiResponse<MinutesVersion>>(`${this.base(meetingId)}/minutes/drafts`, null, true, false).pipe(map(r => r.data));
    }

    update(meetingId: string, version: number, content: MinutesContent): Observable<MinutesVersion> {
        return this.common.put<ApiResponse<MinutesVersion>>(`${this.base(meetingId)}/minutes/${version}`, { content }, false, false).pipe(map(r => r.data));
    }

    transition(meetingId: string, version: number, action: 'submit' | 'approve' | 'publish'): Observable<MinutesVersion> {
        return this.common.post<ApiResponse<MinutesVersion>>(`${this.base(meetingId)}/minutes/${version}/${action}`, null, true, false).pipe(map(r => r.data));
    }

    reject(meetingId: string, version: number, reason: string): Observable<MinutesVersion> {
        return this.common.post<ApiResponse<MinutesVersion>>(`${this.base(meetingId)}/minutes/${version}/reject`, { reason }, true, false).pipe(map(r => r.data));
    }

    // ----- Mẫu biên bản của cuộc họp + "Tải biên bản họp" chạy ngầm (mọi thành viên)
    template(meetingId: string): Observable<MinutesTemplateInfo> {
        return this.common.get<MinutesTemplateInfo>(`${this.base(meetingId)}/minutes/template`, null, false);
    }

    uploadTemplate(meetingId: string, file: File): Observable<MinutesTemplateInfo> {
        return this.common.uploadFiles(`${this.base(meetingId)}/minutes/template`, [file], 'file', undefined, true, true)
            .pipe(map(r => r.data as MinutesTemplateInfo));
    }

    deleteTemplate(meetingId: string): Observable<ApiResponse> {
        return this.common.delete(`${this.base(meetingId)}/minutes/template`, null, false, false);
    }

    requestExport(meetingId: string): Observable<MinutesExport> {
        return this.common.post<ApiResponse<MinutesExport>>(`${this.base(meetingId)}/minutes/exports`, null, false, false).pipe(map(r => r.data));
    }

    exportStatus(exportId: string): Observable<MinutesExport> {
        return this.common.get<MinutesExport>(`minutes/exports/${encodeURIComponent(exportId)}`, null, false);
    }

    exportFile(exportId: string, fallbackName: string): Observable<{ blob: Blob; fileName: string }> {
        return this.common.downloadFile(`minutes/exports/${encodeURIComponent(exportId)}/file`, null, false).pipe(map(res => {
            const disposition = res.headers.get('Content-Disposition') ?? '';
            return { blob: res.body as Blob, fileName: fileNameFromDisposition(disposition, fallbackName) };
        }));
    }

    docx(meetingId: string, version: number): Observable<{ blob: Blob; fileName: string }> {
        return this.common.downloadFile(`${this.base(meetingId)}/minutes/${version}/docx`, null, true).pipe(map(res => {
            const disposition = res.headers.get('Content-Disposition') ?? '';
            const fileName = fileNameFromDisposition(disposition, `BienBan_v${version}.docx`);
            return { blob: res.body as Blob, fileName };
        }));
    }
}

/**
 * Tên file từ Content-Disposition. Ưu tiên filename*=UTF-8'' (RFC 5987); filename="..." của Spring có thể là dạng
 * =?UTF-8?Q?...?= mà trình duyệt/JS không giải mã được nên chỉ dùng làm phương án cuối.
 */
export function fileNameFromDisposition(disposition: string, fallback: string): string {
    const star = /filename\*\s*=\s*UTF-8''([^;]+)/i.exec(disposition);
    if (star) {
        try { return decodeURIComponent(star[1].trim()); } catch { /* rơi xuống phương án sau */ }
    }
    const plain = /filename\s*=\s*"?([^";]+)"?/i.exec(disposition);
    if (plain && !plain[1].startsWith('=?')) {
        try { return decodeURIComponent(plain[1].trim()); } catch { return plain[1].trim(); }
    }
    return fallback;
}

/** Lưu blob thành file tải về. */
export function saveBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** "mm:ss" (hoặc "h:mm:ss") tính từ mốc bắt đầu. */
export function offsetLabel(start: Date | null, at: Date | null): string {
    if (!start || !at) return '00:00';
    const sec = Math.max(0, Math.floor((at.getTime() - start.getTime()) / 1000));
    const pad = (n: number) => String(n).padStart(2, '0');
    const h = Math.floor(sec / 3600);
    return h > 0 ? `${h}:${pad(Math.floor((sec % 3600) / 60))}:${pad(sec % 60)}` : `${pad(Math.floor(sec / 60))}:${pad(sec % 60)}`;
}

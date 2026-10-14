import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiResponse, CommonService, PagedResult } from '../../../shared/services';
import {
    MinutesContent, MinutesDetail, MinutesJob, MinutesListItem, MinutesVersion, TranscriptSegment,
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

    docx(meetingId: string, version: number): Observable<{ blob: Blob; fileName: string }> {
        return this.common.downloadFile(`${this.base(meetingId)}/minutes/${version}/docx`, null, true).pipe(map(res => {
            const disposition = res.headers.get('Content-Disposition') ?? '';
            const match = /filename\*=UTF-8''([^;]+)|filename="?([^";]+)"?/i.exec(disposition);
            const fileName = decodeURIComponent(match?.[1] ?? match?.[2] ?? `BienBan_v${version}.docx`);
            return { blob: res.body as Blob, fileName };
        }));
    }
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

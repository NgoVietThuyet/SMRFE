import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiResponse, CommonService } from '../../../shared/services';

/** MeetingRagChunkDto — đoạn tri thức làm trích dẫn. offset "mm:ss" chỉ có ở đoạn transcript. */
export interface AiCitation {
    id: string;
    sourceType: 'INFO' | 'PARTICIPANT' | 'TASK' | 'MINUTES' | 'TRANSCRIPT' | 'FILE' | string;
    sourceTitle: string;
    speakerName: string | null;
    content: string;
    timestamp: string | null;
    relevanceScore: number;
    offset: string | null;
    segmentId: string | null;
}

export interface AiChatResponse {
    answer: string;
    citations: AiCitation[];
    timestamp: string;
    model: string;
    /** false = máy chủ AI không phản hồi, câu trả lời là trích đoạn dữ liệu. */
    success: boolean;
}

export interface AiRagStatus {
    meetingId: string;
    indexed: boolean;
    chunkCount: number;
    lastIndexedAt: string | null;
    sourcesSummary: string;
}

/** API Trợ lý AI theo cuộc họp (P14): /api/Meeting/{id}/ai/*. BE kiểm tra người hỏi là thành viên. */
@Injectable({
    providedIn: 'root',
})
export class AiAssistantService {
    constructor(private common: CommonService) { }

    private base(id: string): string {
        return `Meeting/${encodeURIComponent(id)}/ai`;
    }

    status(meetingId: string): Observable<AiRagStatus> {
        return this.common.get<AiRagStatus>(`${this.base(meetingId)}/status`, null, false);
    }

    /** Chỉ chủ trì. */
    sync(meetingId: string): Observable<AiRagStatus> {
        return this.common.post<ApiResponse<AiRagStatus>>(`${this.base(meetingId)}/sync`, null, false, false).pipe(map(r => r.data));
    }

    ask(meetingId: string, query: string): Observable<AiChatResponse> {
        return this.common.post<ApiResponse<AiChatResponse>>(`${this.base(meetingId)}/chat`, { query }, false, false).pipe(map(r => r.data));
    }
}

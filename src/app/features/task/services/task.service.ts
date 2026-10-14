import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiResponse, CommonService } from '../../../shared/services';
import {
    Board, CardDetail, ChecklistItem, CreateTaskDto, TaskComment, TaskDetail, TaskFile, TaskGroups, TaskLabel, TaskListItem,
    TaskQuery, TaskSearchResult, TaskStatus, UpdateTaskDto,
} from '../models/task.models';

/** API Công việc (P12): /api/Task/** — CRUD cũ + bảng (board, move, nhãn, checklist, bình luận, đính kèm). */
@Injectable({
    providedIn: 'root',
})
export class TaskService {
    constructor(private common: CommonService) { }

    // ----- Danh sách / sidebar
    query(query: Partial<TaskQuery>, showLoading = false): Observable<TaskSearchResult> {
        const body: TaskQuery = {
            shortcut: 'all', keyword: '', meetingId: null, assignee: null, status: null, priority: null, level: null,
            parentId: null, page: 1, pageSize: 100, group: null, includeArchived: false, ...query,
        };
        return this.common.post<ApiResponse<TaskSearchResult>>('Task/query', body, showLoading, false).pipe(map(r => r.data));
    }

    groups(): Observable<TaskGroups> { return this.common.get<TaskGroups>('Task/groups', null, false) }

    detail(id: string): Observable<TaskDetail> { return this.common.get<TaskDetail>(`Task/${encodeURIComponent(id)}`, null, false) }

    // ----- CRUD
    create(dto: Partial<CreateTaskDto> & { title: string }, notify = true): Observable<TaskListItem> {
        const body: CreateTaskDto = {
            meetingId: null, parentId: null, level: 0, description: null, assigneeUserName: null, dueDate: null,
            status: TaskStatus.NotStarted, priority: 1, isPublic: false, sourceRef: null, startDate: null, color: null, ...dto,
        };
        return this.common.post<ApiResponse<TaskListItem>>('Task', body, false, notify).pipe(map(r => r.data));
    }

    update(id: string, dto: UpdateTaskDto, notify = false): Observable<TaskListItem> {
        return this.common.put<ApiResponse<TaskListItem>>(`Task/${encodeURIComponent(id)}`, dto, false, notify).pipe(map(r => r.data));
    }

    setStatus(id: string, status: TaskStatus): Observable<TaskListItem> {
        return this.common.patch<ApiResponse<TaskListItem>>(`Task/${encodeURIComponent(id)}/status`, { status }, false, false).pipe(map(r => r.data));
    }

    remove(id: string): Observable<ApiResponse> { return this.common.delete(`Task/${encodeURIComponent(id)}`, null, false) }

    setVisibility(id: string, isPublic: boolean): Observable<ApiResponse> {
        return this.common.put(`Task/${encodeURIComponent(id)}/visibility`, { isPublic }, false, false);
    }

    addShare(id: string, userName: string, permission: 0 | 1): Observable<TaskDetail> {
        return this.common.post<ApiResponse<TaskDetail>>(`Task/${encodeURIComponent(id)}/shares`, { userName, permission }, false, false).pipe(map(r => r.data));
    }

    removeShare(id: string, userName: string): Observable<ApiResponse> {
        return this.common.delete(`Task/${encodeURIComponent(id)}/shares/${encodeURIComponent(userName)}`, null, false, false);
    }

    // ----- Bảng
    board(workId: string, archived = false): Observable<Board> {
        return this.common.get<Board>(`Task/${encodeURIComponent(workId)}/board`, archived ? { archived: true } : null, false);
    }

    move(taskId: string, parentId: string, beforeId: string | null): Observable<ApiResponse> {
        return this.common.post(`Task/${encodeURIComponent(taskId)}/move`, { parentId, beforeId }, false, false);
    }

    card(taskId: string): Observable<CardDetail> { return this.common.get<CardDetail>(`Task/${encodeURIComponent(taskId)}/card`, null, false) }

    // ----- Nhãn
    createLabel(workId: string, name: string, color: string): Observable<TaskLabel> {
        return this.common.post<ApiResponse<TaskLabel>>(`Task/${encodeURIComponent(workId)}/labels`, { name, color }, false, false).pipe(map(r => r.data));
    }

    deleteLabel(labelId: string): Observable<ApiResponse> { return this.common.delete(`Task/labels/${encodeURIComponent(labelId)}`, null, false, false) }

    setCardLabels(taskId: string, labelIds: string[]): Observable<string[]> {
        return this.common.put<ApiResponse<string[]>>(`Task/${encodeURIComponent(taskId)}/labels`, { labelIds }, false, false).pipe(map(r => r.data));
    }

    // ----- Checklist
    addChecklist(taskId: string, content: string): Observable<ChecklistItem> {
        return this.common.post<ApiResponse<ChecklistItem>>(`Task/${encodeURIComponent(taskId)}/checklist`, { content }, false, false).pipe(map(r => r.data));
    }

    updateChecklist(itemId: string, patch: { content?: string; done?: boolean }): Observable<ChecklistItem> {
        return this.common.patch<ApiResponse<ChecklistItem>>(`Task/checklist/${encodeURIComponent(itemId)}`, patch, false, false).pipe(map(r => r.data));
    }

    deleteChecklist(itemId: string): Observable<ApiResponse> { return this.common.delete(`Task/checklist/${encodeURIComponent(itemId)}`, null, false, false) }

    // ----- Bình luận
    addComment(taskId: string, content: string): Observable<TaskComment> {
        return this.common.post<ApiResponse<TaskComment>>(`Task/${encodeURIComponent(taskId)}/comments`, { content }, false, false).pipe(map(r => r.data));
    }

    deleteComment(commentId: string): Observable<ApiResponse> { return this.common.delete(`Task/comments/${encodeURIComponent(commentId)}`, null, false, false) }

    // ----- Đính kèm
    uploadFile(taskId: string, file: File): Observable<TaskFile> {
        return this.common.uploadFiles(`Task/${encodeURIComponent(taskId)}/files`, [file], 'file', undefined, false, false).pipe(map(r => r.data));
    }

    deleteFile(fileId: string): Observable<ApiResponse> { return this.common.delete(`Task/files/${encodeURIComponent(fileId)}`, null, false, false) }

    downloadUrl(fileId: string): Observable<{ url: string; expiresIn: number }> {
        return this.common.get<{ url: string; expiresIn: number }>(`Task/files/${encodeURIComponent(fileId)}/download`, null, false);
    }
}

/** Dựng UpdateTaskDto đầy đủ từ thẻ hiện tại + phần thay đổi (PUT Task yêu cầu đủ trường chính). */
export function cardUpdate(card: {
    title: string; description: string | null; assigneeUserName: string | null; dueDate: string | null;
    status: TaskStatus; priority: number; isArchived?: boolean;
}, patch: Partial<UpdateTaskDto> = {}): UpdateTaskDto {
    return {
        title: card.title,
        description: card.description,
        assigneeUserName: card.assigneeUserName,
        dueDate: card.dueDate ? toIso(card.dueDate) : null,
        status: card.status,
        priority: card.priority,
        sourceRef: null,
        parentId: null,
        level: null,
        startDate: null,
        color: null,
        isArchived: null,
        clearDates: null,
        ...patch,
    };
}

/** Chuỗi LocalDateTime UTC của BE → ISO có Z để gửi lại không bị lệch giờ. */
function toIso(v: string): string {
    return /[zZ]|[+-]\d\d:\d\d$/.test(v) ? v : v + 'Z';
}

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import { ApiResponse } from '../models/auth.models';
import {
    CreateTaskRequest,
    TaskDetail,
    TaskListItem,
    TaskSearchRequest,
    TaskSearchResult,
    TaskShareRequest,
    UpdateTaskRequest,
} from '../models/task.models';

// TaskService — gọi /api/Task (BE TaskController).
// Mọi response bọc ApiResponse {status,message,data}: !status → throw Error(message).
@Injectable({ providedIn: 'root' })
export class TaskService {
    private readonly http = inject(HttpClient);

    // POST /api/Task/query — danh sách + summary đếm chip
    query(dto: TaskSearchRequest): Observable<TaskSearchResult> {
        return this.http
            .post<ApiResponse<TaskSearchResult>>(`${API_BASE_URL}/api/Task/query`, dto)
            .pipe(
                map((res) => {
                    if (!res.status || !res.data) {
                        throw new Error(res.message || 'Không thể tải danh sách công việc.');
                    }
                    return res.data;
                })
            );
    }

    // GET /api/Task/{id} — chi tiết kèm shares (chỉ creator nhận được shares)
    get(id: string): Observable<TaskDetail> {
        return this.http
            .get<ApiResponse<TaskDetail>>(`${API_BASE_URL}/api/Task/${id}`)
            .pipe(
                map((res) => {
                    if (!res.status || !res.data) {
                        throw new Error(res.message || 'Không tìm thấy công việc.');
                    }
                    return res.data;
                })
            );
    }

    // POST /api/Task
    create(payload: CreateTaskRequest): Observable<TaskListItem> {
        return this.http
            .post<ApiResponse<TaskListItem>>(`${API_BASE_URL}/api/Task`, payload)
            .pipe(
                map((res) => {
                    if (!res.status || !res.data) {
                        throw new Error(res.message || 'Tạo công việc thất bại.');
                    }
                    return res.data;
                })
            );
    }

    // PUT /api/Task/{id} — chỉ nội dung; quyền: creator hoặc share Edit
    update(id: string, payload: UpdateTaskRequest): Observable<TaskListItem> {
        return this.http
            .put<ApiResponse<TaskListItem>>(`${API_BASE_URL}/api/Task/${id}`, payload)
            .pipe(
                map((res) => {
                    if (!res.status || !res.data) {
                        throw new Error(res.message || 'Cập nhật công việc thất bại.');
                    }
                    return res.data;
                })
            );
    }

    // PATCH /api/Task/{id}/status — cập nhật trạng thái nhanh (kéo thả Kanban)
    updateStatus(id: string, status: number): Observable<TaskListItem> {
        return this.http
            .patch<ApiResponse<TaskListItem>>(`${API_BASE_URL}/api/Task/${id}/status`, { status })
            .pipe(
                map((res) => {
                    if (!res.status || !res.data) {
                        throw new Error(res.message || 'Cập nhật trạng thái công việc thất bại.');
                    }
                    return res.data;
                })
            );
    }

    // DELETE /api/Task/{id} — chỉ creator
    remove(id: string): Observable<void> {
        return this.http
            .delete<ApiResponse<null>>(`${API_BASE_URL}/api/Task/${id}`)
            .pipe(
                map((res) => {
                    if (!res.status) throw new Error(res.message || 'Xóa công việc thất bại.');
                })
            );
    }

    // PUT /api/Task/{id}/visibility — bật/tắt công khai, chỉ creator
    setVisibility(id: string, isPublic: boolean): Observable<void> {
        return this.http
            .put<ApiResponse<null>>(`${API_BASE_URL}/api/Task/${id}/visibility`, { isPublic })
            .pipe(
                map((res) => {
                    if (!res.status) throw new Error(res.message || 'Cập nhật quyền công khai thất bại.');
                })
            );
    }

    // POST /api/Task/{id}/shares — chỉ creator; trùng (task,user) → 409
    addShare(id: string, payload: TaskShareRequest): Observable<TaskDetail> {
        return this.http
            .post<ApiResponse<TaskDetail>>(`${API_BASE_URL}/api/Task/${id}/shares`, payload)
            .pipe(
                map((res) => {
                    if (!res.status || !res.data) {
                        throw new Error(res.message || 'Chia sẻ công việc thất bại.');
                    }
                    return res.data;
                })
            );
    }

    // DELETE /api/Task/{id}/shares/{userName} — chỉ creator
    removeShare(id: string, userName: string): Observable<void> {
        return this.http
            .delete<ApiResponse<null>>(`${API_BASE_URL}/api/Task/${id}/shares/${encodeURIComponent(userName)}`)
            .pipe(
                map((res) => {
                    if (!res.status) throw new Error(res.message || 'Xóa người được chia sẻ thất bại.');
                })
            );
    }
}

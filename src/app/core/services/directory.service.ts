import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, map, Observable, throwError } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';
import {
    CreateDirectoryEmployeeRequest,
    CreateOrganizationRequest,
    DirectoryEmployee,
    DirectoryTitle,
    OrganizationFlat,
    PagedDirectoryEmployees,
    TitleRequest,
    UpdateDirectoryEmployeeRequest,
} from '../models/directory.models';

// DirectoryService — gọi /api/human-resources (BE HumanResourcesController).
// Lưu ý envelope: controller này trả Ok(...) RAW (không bọc ApiResponse
// {status,message,data} như Meeting/Task). Lỗi BE trả {message} qua
// BadRequest/Conflict/NotFound → map sang Error(message) ở catchError.
@Injectable({ providedIn: 'root' })
export class DirectoryService {
    private readonly http = inject(HttpClient);
    private readonly base = `${API_BASE_URL}/api/human-resources`;

    private toError(err: unknown, fallback: string): Observable<never> {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const msg = (err as any)?.error?.message as string | undefined;
        return throwError(() => new Error(msg || fallback));
    }

    // GET organization-tree — flat + employeeCount, FE tự dựng cây từ Id/PId
    organizations(): Observable<OrganizationFlat[]> {
        return this.http
            .get<OrganizationFlat[]>(`${this.base}/organization-tree`)
            .pipe(catchError((e) => this.toError(e, 'Không thể tải cơ cấu tổ chức.')));
    }

    // GET titles
    titles(): Observable<DirectoryTitle[]> {
        return this.http
            .get<DirectoryTitle[]>(`${this.base}/titles`)
            .pipe(catchError((e) => this.toError(e, 'Không thể tải danh sách chức danh.')));
    }

    // POST titles
    createTitle(payload: TitleRequest): Observable<void> {
        return this.http
            .post<void>(`${this.base}/titles`, payload)
            .pipe(catchError((e) => this.toError(e, 'Thêm chức danh thất bại.')));
    }

    // PUT titles/{code}
    updateTitle(code: string, payload: TitleRequest): Observable<void> {
        return this.http
            .put<void>(`${this.base}/titles/${encodeURIComponent(code)}`, payload)
            .pipe(catchError((e) => this.toError(e, 'Cập nhật chức danh thất bại.')));
    }

    // DELETE titles/{code}
    deleteTitle(code: string): Observable<void> {
        return this.http
            .delete<void>(`${this.base}/titles/${encodeURIComponent(code)}`)
            .pipe(catchError((e) => this.toError(e, 'Xóa chức danh thất bại.')));
    }

    // GET employees — lọc org/title/active/keyword + phân trang server-side
    employees(opts: {
        organizationId?: string | null;
        titleCode?: string | null;
        active?: boolean | null;
        keyword?: string;
        page?: number;
        pageSize?: number;
    }): Observable<PagedDirectoryEmployees> {
        let params = new HttpParams();
        if (opts.organizationId) params = params.set('organizationId', opts.organizationId);
        if (opts.titleCode) params = params.set('titleCode', opts.titleCode);
        if (opts.active !== undefined && opts.active !== null) params = params.set('active', String(opts.active));
        if (opts.keyword?.trim()) params = params.set('keyword', opts.keyword.trim());
        params = params.set('page', String(opts.page ?? 1)).set('pageSize', String(opts.pageSize ?? 20));
        return this.http
            .get<PagedDirectoryEmployees>(`${this.base}/employees`, { params })
            .pipe(catchError((e) => this.toError(e, 'Không thể tải danh sách nhân sự.')));
    }

    // GET employees/{userName} — chi tiết nhân sự (raw)
    employee(userName: string): Observable<DirectoryEmployee> {
        return this.http
            .get<DirectoryEmployee>(`${this.base}/employees/${encodeURIComponent(userName)}`)
            .pipe(catchError((e) => this.toError(e, 'Không tìm thấy nhân sự.')));
    }

    // POST directory-employees — BE tự sinh userName + password, trả {userName}
    createEmployee(payload: CreateDirectoryEmployeeRequest): Observable<string> {
        return this.http
            .post<{ userName: string }>(`${this.base}/directory-employees`, payload)
            .pipe(
                map((res) => {
                    if (!res?.userName) throw new Error('Thêm nhân sự thất bại.');
                    return res.userName;
                }),
                catchError((e) =>
                    e instanceof Error && e.message === 'Thêm nhân sự thất bại.'
                        ? throwError(() => e)
                        : this.toError(e, 'Thêm nhân sự thất bại.')
                )
            );
    }

    // PUT employees/{userName} — 204 No Content
    updateEmployee(userName: string, payload: UpdateDirectoryEmployeeRequest): Observable<void> {
        return this.http
            .put<void>(`${this.base}/employees/${encodeURIComponent(userName)}`, payload)
            .pipe(catchError((e) => this.toError(e, 'Cập nhật nhân sự thất bại.')));
    }

    // PUT employees/{userName}/status — 204
    setStatus(userName: string, isActive: boolean): Observable<void> {
        return this.http
            .put<void>(`${this.base}/employees/${encodeURIComponent(userName)}/status`, { isActive })
            .pipe(catchError((e) => this.toError(e, 'Đổi trạng thái thất bại.')));
    }

    // POST employees/{userName}/reset-password — 204/kèm pass, FE không hiển thị
    resetPassword(userName: string): Observable<void> {
        return this.http
            .post<void>(`${this.base}/employees/${encodeURIComponent(userName)}/reset-password`, {})
            .pipe(catchError((e) => this.toError(e, 'Đặt lại mật khẩu thất bại.')));
    }

    // POST organizations — trả entity, FE chỉ cần thành công
    createOrganization(payload: CreateOrganizationRequest): Observable<void> {
        return this.http
            .post<void>(`${this.base}/organizations`, {
                name: payload.name,
                parentId: payload.parentId ?? null,
                orderNumber: payload.orderNumber,
                isActive: payload.isActive,
                notes: payload.notes ?? null,
            })
            .pipe(catchError((e) => this.toError(e, 'Thêm phòng ban thất bại.')));
    }

    // PUT organizations/{id} — 204
    updateOrganization(id: string, payload: CreateOrganizationRequest): Observable<void> {
        return this.http
            .put<void>(`${this.base}/organizations/${encodeURIComponent(id)}`, {
                name: payload.name,
                parentId: payload.parentId ?? null,
                orderNumber: payload.orderNumber,
                isActive: payload.isActive,
                notes: payload.notes ?? null,
            })
            .pipe(catchError((e) => this.toError(e, 'Cập nhật phòng ban thất bại.')));
    }

    // DELETE organizations/{id} — 204; BE 409 khi còn con/NV
    deleteOrganization(id: string): Observable<void> {
        return this.http
            .delete<void>(`${this.base}/organizations/${encodeURIComponent(id)}`)
            .pipe(catchError((e) => this.toError(e, 'Xóa phòng ban thất bại.')));
    }
}

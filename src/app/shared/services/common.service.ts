import { Injectable } from '@angular/core'
import { HttpClient, HttpErrorResponse, HttpParams, HttpResponse } from '@angular/common/http'
import { Observable, throwError, BehaviorSubject } from 'rxjs'
import { catchError, map, finalize, switchMap, filter, take } from 'rxjs/operators'
import { Router } from '@angular/router'
import { NzNotificationService } from 'ng-zorro-antd/notification'
import { NzMessageService } from 'ng-zorro-antd/message'
import { EnvironmentService, LoadingService, TokenService } from '../../core'
import { LocalStorageUtils } from '../utils'
import { PaginationResult } from '../models'

/** Envelope của BE-Java: ApiResponse<T> = { status, message, data }. */
export interface ApiResponse<T = any> {
    status: boolean
    message: string | null
    data: T
}

/** PagedResultResponse<T> của BE-Java. */
export interface PagedResult<T = any> {
    items: T[]
    page: number
    pageSize: number
    totalItems: number
    totalPages: number
}

/**
 * Lớp gọi API dùng chung (giữ cách dùng của 2.FrontEnd):
 *   • get  → trả về `data` (hoặc nguyên body nếu API trả object thuần)
 *   • post/put/patch/delete → trả về envelope `{ status, message, data }` (API trả object thuần/204 cũng được bọc lại)
 *   • status=false hoặc HTTP lỗi → tự hiện thông báo; 401 → refresh token rồi gọi lại một lần.
 * BE-Java không thống nhất kiểu trả về: Auth/Meeting/Task/File/Notification dùng ApiResponse,
 * human-resources/permissions trả object thuần hoặc 204 — nên phải nhận cả hai.
 */
@Injectable({
    providedIn: 'root',
})
export class CommonService {
    private refreshTokenInProgress = false
    private refreshTokenSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null)

    constructor(
        private http: HttpClient,
        private router: Router,
        private notification: NzNotificationService,
        private _loading: LoadingService,
        private env: EnvironmentService,
        private message: NzMessageService,
        private tokenService: TokenService,
    ) { }

    /** Chuyển PagedResultResponse của BE-Java sang PaginationResult quen dùng ở 2.FrontEnd. */
    toPagination<T = any>(paged: PagedResult<T> | null | undefined): PaginationResult {
        const result = new PaginationResult()
        if (!paged) return result
        result.data = paged.items ?? []
        result.currentPage = paged.page ?? 1
        result.pageSize = paged.pageSize ?? 0
        result.totalRecord = paged.totalItems ?? 0
        result.totalPage = paged.totalPages ?? 0
        return result
    }

    private buildParams(params?: any): HttpParams {
        let httpParams = new HttpParams()
        if (!params) return httpParams

        const flattenParams = (obj: any, parentKey: string = ''): void => {
            Object.keys(obj).forEach((key) => {
                const fullKey = parentKey ? `${parentKey}.${key}` : key
                const value = obj[key]

                if (value !== null && value !== undefined && value !== '') {
                    if (typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                        flattenParams(value, fullKey)
                    } else if (Array.isArray(value)) {
                        value.forEach((item) => {
                            httpParams = httpParams.append(fullKey, item)
                        })
                    } else {
                        httpParams = httpParams.append(fullKey, value instanceof Date ? value.toISOString() : value)
                    }
                }
            })
        }

        flattenParams(params)
        return httpParams
    }

    private isEnvelope(response: any): response is ApiResponse {
        return response !== null && typeof response === 'object' && typeof response.status === 'boolean'
            && 'data' in response
    }

    private handleGetResponse = (response: any) => {
        if (!this.isEnvelope(response)) {
            return response
        }
        if (response.status === false) {
            this.showError(response.message)
            const err: any = new Error(response.message || 'Lỗi từ server')
            err.alreadyHandled = true
            throw err
        }
        return response.data
    }

    private handleResponse(response: any, notifySuccess = true): ApiResponse {
        const envelope: ApiResponse = this.isEnvelope(response)
            ? response
            : { status: true, message: null, data: response ?? null }

        if (envelope.status === false) {
            this.showError(envelope.message)
            const err: any = new Error(envelope.message || 'Lỗi từ server')
            err.alreadyHandled = true
            throw err
        }
        if (notifySuccess && envelope.message) {
            this.message.success(envelope.message)
        }
        return envelope
    }

    private resolveUrl(endpoint: string): string {
        if (/^https?:\/\//i.test(endpoint)) {
            return endpoint
        }
        const base = this.env.getEnv('baseUrl') || ''
        return `${base}/${endpoint}`
    }

    private withLoading<T>(source: Observable<T>, showLoading: boolean): Observable<T> {
        if (showLoading) {
            this._loading.setLoading(true)
        }
        return source.pipe(
            finalize(() => {
                if (showLoading) {
                    this._loading.setLoading(false)
                }
            }),
        )
    }

    get<T>(endpoint: string, params?: any, showLoading: boolean = true): Observable<T> {
        return this.withLoading(
            this.http.get<any>(this.resolveUrl(endpoint), { params: this.buildParams(params) }).pipe(
                map(this.handleGetResponse),
                catchError((error) => this.handleError(error, () => this.get<T>(endpoint, params, showLoading))),
            ),
            showLoading,
        )
    }

    post<T = ApiResponse>(endpoint: string, data: any, showLoading: boolean = true, notifySuccess: boolean = true): Observable<T> {
        return this.withLoading(
            this.http.post<any>(this.resolveUrl(endpoint), data).pipe(
                map((response) => this.handleResponse(response, notifySuccess) as T),
                catchError((error) => this.handleError(error, () => this.post<T>(endpoint, data, showLoading, notifySuccess))),
            ),
            showLoading,
        )
    }

    put<T = ApiResponse>(endpoint: string, data: any, showLoading: boolean = true, notifySuccess: boolean = true): Observable<T> {
        return this.withLoading(
            this.http.put<any>(this.resolveUrl(endpoint), data).pipe(
                map((response) => this.handleResponse(response, notifySuccess) as T),
                catchError((error) => this.handleError(error, () => this.put<T>(endpoint, data, showLoading, notifySuccess))),
            ),
            showLoading,
        )
    }

    patch<T = ApiResponse>(endpoint: string, data: any, showLoading: boolean = true, notifySuccess: boolean = true): Observable<T> {
        return this.withLoading(
            this.http.patch<any>(this.resolveUrl(endpoint), data).pipe(
                map((response) => this.handleResponse(response, notifySuccess) as T),
                catchError((error) => this.handleError(error, () => this.patch<T>(endpoint, data, showLoading, notifySuccess))),
            ),
            showLoading,
        )
    }

    delete<T = ApiResponse>(endpoint: string, data: any = null, showLoading: boolean = true, notifySuccess: boolean = true): Observable<T> {
        return this.withLoading(
            this.http.delete<any>(this.resolveUrl(endpoint), data ? { body: data } : {}).pipe(
                map((response) => this.handleResponse(response, notifySuccess) as T),
                catchError((error) => this.handleError(error, () => this.delete<T>(endpoint, data, showLoading, notifySuccess))),
            ),
            showLoading,
        )
    }

    uploadFiles(
        endpoint: string,
        files: File[],
        fieldName: string = 'files',
        extraFields?: Record<string, any>,
        showLoading: boolean = true,
        notifySuccess: boolean = true,
    ): Observable<ApiResponse> {
        const formData = new FormData()
        files.forEach(file => formData.append(fieldName, file, file.name))
        if (extraFields) {
            Object.keys(extraFields).forEach(key => formData.append(key, extraFields[key]))
        }

        return this.withLoading(
            this.http.post<any>(this.resolveUrl(endpoint), formData).pipe(
                map((response) => this.handleResponse(response, notifySuccess)),
                catchError((error) => this.handleError(error, () => this.uploadFiles(endpoint, files, fieldName, extraFields, showLoading, notifySuccess))),
            ),
            showLoading,
        )
    }

    downloadFile(endpoint: string, params?: any, showLoading: boolean = true): Observable<HttpResponse<Blob>> {
        return this.withLoading(
            this.http.get(this.resolveUrl(endpoint), {
                params: this.buildParams(params),
                responseType: 'blob',
                observe: 'response',
            }).pipe(
                catchError((error) => this.handleError(error, () => this.downloadFile(endpoint, params, showLoading))),
            ),
            showLoading,
        )
    }

    showSuccess(message: string | null | undefined): void {
        if (message) {
            this.message.success(message)
        }
    }

    showError(message: string | null | undefined, title: string = 'Lỗi'): void {
        this.notification.create('error', title, message || 'Đã xảy ra lỗi không xác định', {
            nzDuration: 8000,
            nzPlacement: 'topLeft',
            nzStyle: { whiteSpace: 'pre-line' },
            nzClass: 'custom-notification',
        })
    }

    /** Lấy câu thông báo lỗi từ body Spring (ApiResponse hoặc lỗi mặc định/validation). */
    private extractErrorMessage(error: HttpErrorResponse): string {
        const body: any = error?.error
        if (body && typeof body === 'object') {
            if (typeof body.message === 'string' && body.message) return body.message
            if (Array.isArray(body.errors) && body.errors.length) {
                return body.errors.map((e: any) => e?.defaultMessage || e?.message || e).join('\n')
            }
            if (typeof body.error === 'string' && body.error) return body.error
        }
        if (typeof body === 'string' && body && body.length < 300) return body
        return error?.message || 'Đã xảy ra lỗi không xác định'
    }

    private handleError = (error: HttpErrorResponse, retryCallback: () => Observable<any>): Observable<any> => {
        if ((error as any)?.alreadyHandled) {
            return throwError(() => error)
        }

        if (error?.status === 0 || error?.status === 503) {
            this._loading.reset()
            this.router.navigate(['error-server'])
            return throwError(() => error)
        }

        if (error?.status === 429) {
            this.showError('Quá nhiều yêu cầu. Vui lòng đợi khoảng 1 phút rồi thử lại.')
            return throwError(() => error)
        }

        if (error?.status === 401) {
            if (!this.refreshTokenInProgress) {
                this.refreshTokenInProgress = true
                this.refreshTokenSubject.next(null)

                return this.tokenService.refreshSession().pipe(
                    switchMap((ok) => {
                        this.refreshTokenInProgress = false
                        this.refreshTokenSubject.next(ok)
                        if (!ok) {
                            this.clearAuthAndRedirect()
                            return throwError(() => new Error('Phiên đăng nhập đã hết hạn'))
                        }
                        return retryCallback()
                    }),
                    catchError((err) => {
                        this.refreshTokenInProgress = false
                        if (!(err instanceof HttpErrorResponse)) {
                            this.clearAuthAndRedirect()
                        }
                        return throwError(() => err)
                    }),
                )
            }
            return this.refreshTokenSubject.pipe(
                filter(result => result !== null),
                take(1),
                switchMap((ok) => ok ? retryCallback() : throwError(() => error)),
            )
        }

        const title = error?.status === 403 ? 'Không có quyền' : 'Lỗi'
        this.showError(this.extractErrorMessage(error), title)
        return throwError(() => error)
    }

    private clearAuthAndRedirect(): void {
        const returnUrl = this.router.url
        this.refreshTokenInProgress = false
        this.refreshTokenSubject.next(null)
        this.tokenService.clear()
        LocalStorageUtils.clear()

        if (returnUrl && !returnUrl.startsWith('/login')) {
            this.router.navigate(['/login'], { queryParams: { returnUrl } })
            return
        }
        this.router.navigate(['/login'])
    }
}

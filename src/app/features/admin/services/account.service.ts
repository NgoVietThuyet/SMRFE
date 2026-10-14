import { Injectable } from '@angular/core';
import { Observable, map } from 'rxjs';
import { CommonService, PagedResult } from '../../../shared/services';
import { PaginationResult } from '../../../shared/models';
import { CreatedEmployee, Employee, EmployeeDto, EmployeeFilter } from '../models/admin.models';

/** Tài khoản = nhân sự trong BE-Java (/api/human-resources/employees). */
@Injectable({
    providedIn: 'root',
})
export class AccountService {
    constructor(private common: CommonService) { }

    search(filter: EmployeeFilter): Observable<PaginationResult> { return this.common.get<PagedResult<Employee>>('human-resources/employees', filter).pipe(map(res => this.common.toPagination(res))) }

    detail(userName: string): Observable<Employee> { return this.common.get<Employee>(`human-resources/employees/${encodeURIComponent(userName)}`) }

    /** Tạo với username tự đặt — BE trả mật khẩu tạm (chỉ hiển thị một lần). */
    create(data: EmployeeDto): Observable<CreatedEmployee> { return this.common.post<any>('human-resources/employees', data, true, false).pipe(map(res => res.data)) }

    /** Tạo từ danh bạ — BE tự sinh username từ họ tên. */
    createFromDirectory(data: EmployeeDto): Observable<{ userName: string; temporaryPassword: string }> { return this.common.post<any>('human-resources/directory-employees', { fullName: data.fullName, email: data.email, phone: data.phone, address: data.address, organizationId: data.organizationId, titleCode: data.titleCode }, true, false).pipe(map(res => res.data)) }

    update(userName: string, data: EmployeeDto) { return this.common.put(`human-resources/employees/${encodeURIComponent(userName)}`, { fullName: data.fullName, email: data.email, phone: data.phone, address: data.address, organizationId: data.organizationId, titleCode: data.titleCode }) }

    transfer(userName: string, organizationId: string, reason: string) { return this.common.put(`human-resources/employees/${encodeURIComponent(userName)}/organization`, { organizationId, reason }) }

    changeTitle(userName: string, titleCode: string) { return this.common.put(`human-resources/employees/${encodeURIComponent(userName)}/title`, { titleCode }) }

    changeStatus(userName: string, isActive: boolean, reason: string) { return this.common.put(`human-resources/employees/${encodeURIComponent(userName)}/status`, { isActive, reason }) }

    resetPassword(userName: string): Observable<{ userName: string; temporaryPassword: string }> { return this.common.post<any>(`human-resources/employees/${encodeURIComponent(userName)}/reset-password`, {}, true, false).pipe(map(res => res.data)) }

    static isAdmin(e: Pick<Employee, 'roleCodes'>): boolean {
        return (e.roleCodes ?? '').toUpperCase().includes('SUPER_ADMIN');
    }
}

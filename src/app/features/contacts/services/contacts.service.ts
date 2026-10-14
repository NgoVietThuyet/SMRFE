import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CommonService, PagedResult } from '../../../shared/services';

/** ContactResponse — GET /api/contacts (P15, chỉ đọc). */
export interface Contact {
    userName: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    orgId: string | null;
    organizationName: string | null;
    titleCode: string | null;
    titleName: string | null;
}

@Injectable({
    providedIn: 'root',
})
export class ContactsService {
    constructor(private common: CommonService) { }

    /** organizationId gồm cả phòng ban con; keyword tìm không phân biệt dấu (BE xử lý). */
    search(organizationId: string | null, keyword: string, page: number, pageSize: number, showLoading = false): Observable<PagedResult<Contact>> {
        return this.common.get<PagedResult<Contact>>('contacts', { organizationId, keyword, page, pageSize }, showLoading);
    }
}

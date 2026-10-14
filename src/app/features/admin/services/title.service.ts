import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CommonService } from '../../../shared/services';
import { Title, TitleDto } from '../models/admin.models';

@Injectable({
    providedIn: 'root',
})
export class TitleService {
    constructor(private common: CommonService) { }

    list(showLoading = true): Observable<Title[]> { return this.common.get<Title[]>('human-resources/titles', null, showLoading) }

    create(data: TitleDto) { return this.common.post('human-resources/titles', data) }

    update(code: string, data: TitleDto) { return this.common.put(`human-resources/titles/${encodeURIComponent(code)}`, data) }

    delete(code: string) { return this.common.delete(`human-resources/titles/${encodeURIComponent(code)}`) }
}

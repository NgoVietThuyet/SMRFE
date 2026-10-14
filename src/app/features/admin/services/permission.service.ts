import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CommonService } from '../../../shared/services';
import { EffectivePermission, PermissionCatalogGroup, PermissionDocument, PermissionTargetType } from '../models/admin.models';

@Injectable({
    providedIn: 'root',
})
export class PermissionService {
    constructor(private common: CommonService) { }

    catalog(): Observable<PermissionCatalogGroup[]> { return this.common.get<PermissionCatalogGroup[]>('permissions/catalog', null, false) }

    get(type: PermissionTargetType, id: string): Observable<PermissionDocument> { return this.common.get<PermissionDocument>(`human-resources/${type}/${encodeURIComponent(id)}/permissions`) }

    save(type: PermissionTargetType, id: string, doc: PermissionDocument) { return this.common.put(`human-resources/${type}/${encodeURIComponent(id)}/permissions`, doc) }

    effective(userName: string): Observable<EffectivePermission[]> { return this.common.get<EffectivePermission[]>(`human-resources/employees/${encodeURIComponent(userName)}/effective-permissions`) }
}

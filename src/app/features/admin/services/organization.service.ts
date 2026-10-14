import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { NzTreeNodeOptions } from 'ng-zorro-antd/tree';
import { CommonService } from '../../../shared/services';
import { OrganizationDto, OrganizationNode } from '../models/admin.models';

@Injectable({
    providedIn: 'root',
})
export class OrganizationService {
    constructor(private common: CommonService) { }

    tree(showLoading = true): Observable<OrganizationNode[]> { return this.common.get<OrganizationNode[]>('human-resources/organization-tree', null, showLoading) }

    create(data: OrganizationDto) { return this.common.post('human-resources/organizations', data) }

    update(id: string, data: OrganizationDto) { return this.common.put(`human-resources/organizations/${encodeURIComponent(id)}`, data) }

    move(id: string, parentId: string, orderNumber: number) { return this.common.put(`human-resources/organizations/${encodeURIComponent(id)}/move`, { parentId, orderNumber }, false) }

    delete(id: string) { return this.common.delete(`human-resources/organizations/${encodeURIComponent(id)}`) }

    /** Danh sách phẳng (pId) → cây cho nz-tree / nz-tree-select. Nút cha không tồn tại thì đưa lên gốc. */
    static toNzTree(list: OrganizationNode[], options: { expandAll?: boolean; selectableInactive?: boolean } = {}): NzTreeNodeOptions[] {
        const ids = new Set(list.map(o => o.id));
        const byParent = new Map<string, OrganizationNode[]>();
        for (const o of list) {
            const parent = o.pId && ids.has(o.pId) && o.pId !== o.id ? o.pId : '';
            if (!byParent.has(parent)) byParent.set(parent, []);
            byParent.get(parent)!.push(o);
        }
        const build = (parent: string, seen: Set<string>): NzTreeNodeOptions[] =>
            (byParent.get(parent) ?? [])
                .sort((a, b) => a.orderNumber - b.orderNumber || a.name.localeCompare(b.name, 'vi'))
                .filter(o => !seen.has(o.id))
                .map(o => {
                    const children = build(o.id, new Set(seen).add(o.id));
                    return {
                        key: o.id,
                        title: o.name,
                        expanded: options.expandAll ?? o.expanded,
                        isLeaf: children.length === 0,
                        disabled: options.selectableInactive === false && !o.isActive,
                        children,
                        origin: o,
                    } as NzTreeNodeOptions;
                });
        return build('', new Set());
    }
}

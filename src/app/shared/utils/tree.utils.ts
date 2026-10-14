import { MENU_PARENT_ROOT } from './const';

export class TreeUtils {
    /** Chuẩn hoá danh sách phẳng + build cây, chặn PId vòng / tự tham chiếu (tránh stack overflow). */
    private static buildNzTree(
        list: any[],
        rootParentId: string,
        normalizePid?: (pId: string | null | undefined, item: any) => string | null | undefined,
    ): any[] {
        const unique = Array.from(
            new Map(list.filter(x => x?.id != null).map(item => [String(item.id), item])).values(),
        );

        const normalized = unique.map(item => {
            let pId = normalizePid ? normalizePid(item.pId, item) : item.pId;
            const id = String(item.id);
            if (pId === id) {
                pId = rootParentId;
            }
            return { ...item, pId: pId ?? rootParentId };
        });

        const knownIds = new Set(normalized.map(x => String(x.id)));
        for (const item of normalized) {
            const pid = item.pId;
            if (pid && pid !== rootParentId && !knownIds.has(String(pid))) {
                item.pId = rootParentId;
            }
        }

        const build = (parentId: string, level: number, ancestors: Set<string>): any[] => {
            return normalized
                .filter(item => item.pId === parentId)
                .sort((a, b) => (a.orderNumber ?? 0) - (b.orderNumber ?? 0))
                .map(item => {
                    const id = String(item.id);
                    const isCycle = ancestors.has(id);
                    const nextAncestors = new Set(ancestors);
                    nextAncestors.add(id);
                    const children = isCycle ? [] : build(id, level + 1, nextAncestors);
                    return {
                        key: item.id,
                        title: item.name,
                        ...item,
                        level,
                        children: children.length > 0 ? children : null,
                    };
                });
        };

        return build(rootParentId, 1, new Set([rootParentId]));
    }

    static buildNzMenuTree(list: any[]): any[] {
        return this.buildNzTree(list, MENU_PARENT_ROOT, (pId, item) => {
            let pid = pId === '0' ? MENU_PARENT_ROOT : pId;
            if (pid === item?.id) {
                pid = MENU_PARENT_ROOT;
            }
            return pid;
        });
    }

    static buildNzRightTree(list: any[]): any[] {
        return this.buildNzTree(list, 'RIGHT');
    }

    static buildNzConfigStructTree(list: any[]): any[] {
        return this.buildNzTree(list, 'STRUCT');
    }

    static buildNzOrgTree(list: any[]): any[] {
        return this.buildNzTree(list, 'ORG');
    }

    static buildNzPrjectTree(list: any[]): any[] {
        return this.buildNzTree(list, 'STRUCT_PROJECT');
    }

    static flattenTree(nodes: any[]): any[] {
        let result: any[] = [];
        nodes.forEach(node => {
            const { children, ...rest } = node;
            result.push(rest);
            if (node.children && node.children.length > 0) {
                result = result.concat(this.flattenTree(node.children));
            }
        });
        return result;
    }
}

import { Injectable } from "@angular/core";
import { Observable, Subject } from "rxjs";
import { LocalStorageUtils } from "../../shared/utils";
import { LoadingService } from "./loading.service";

@Injectable({ providedIn: 'root' })
export class GlobalService {
    breadcrumbSubject: Subject<boolean> = new Subject<boolean>()
    accountInfoUpdated$ = new Subject<any>();
    /** Phát sau khi admin cập nhật thứ tự / cấu hình menu — sidebar reload. */
    menuTreeRefresh$ = new Subject<void>();
    breadcrumb: any = []

    constructor(
        private _loading: LoadingService,
    ) {
        this.breadcrumbSubject.subscribe((value) => {
            this.breadcrumb = value
        })
    }
    
    setBreadcrumb(value: any) {
        localStorage.setItem('breadcrumb', JSON.stringify(value))
        this.breadcrumbSubject.next(value)
    }

    getBreadcrumb() {
        try {
            if (this.breadcrumb && this.breadcrumb?.length > 0) {
                return this.breadcrumb
            }
            const breadcrumb = localStorage.getItem('breadcrumb')
            return breadcrumb ? JSON.parse(breadcrumb) : null
        } catch (e) {
            return null
        }
    }
    
    getInitialsAvatar(fullName: string): string {
        if (!fullName) return '?';
        const parts = fullName.trim().split(/\s+/);
        if (parts.length === 1) {
            return parts[0][0].toUpperCase();
        }
        const first = parts[0][0].toUpperCase();
        const last = parts[parts.length - 1][0].toUpperCase();
        return first + last;
    }

    getAvatarColor(nameOrId: string): string {
        if (!nameOrId) return '#1890ff';
        const firstChar = nameOrId.charAt(0).toUpperCase();
        const code = firstChar.charCodeAt(0);
        const group = Math.floor((code - 65) / 2);

        const colors = [
            '#1890ff', '#52c41a', '#faad14', '#eb2f96', '#13c2c2',
            '#722ed1', '#fa541c', '#2f54eb', '#a0d911', '#f759ab',
            '#36cfc9', '#9254de', '#f5222d', '#73d13d', '#ffc53d',
            '#597ef7', '#ff85c0', '#5cdbd3', '#b37feb', '#ff4d4f'
        ];

        return colors[group % colors.length];
    }

    /** BE-Java chưa có API ảnh đại diện → luôn dùng chữ cái + màu. */
    getAccountAvatarUrl(_userName?: string | null, _avatarFileId?: string | null, _cacheBust?: string | number): string | null {
        return null;
    }

    updateStoredAccountInfo(partial: Record<string, any>): any {
        const current = LocalStorageUtils.getItem('accountInfo') || {};
        const updated = { ...current, ...partial, avatarVersion: Date.now() };
        LocalStorageUtils.setItem('accountInfo', updated);
        this.accountInfoUpdated$.next(updated);
        return updated;
    }

    formatDateTime(dateInput: any): string {
        const date = new Date(dateInput);

        if (isNaN(date.getTime())) {
            console.error("Invalid date:", dateInput);
            return "";
        }

        const yyyy = date.getFullYear();
        const MM = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');

        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        const ss = String(date.getSeconds()).padStart(2, '0');

        return `${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}`;
    }

    getRightsUser(): string[] {
        const user = LocalStorageUtils.getItem('accountInfo');
        return user?.rights || [];
    }

    hasRight(rightCode: string): boolean {
        if (!rightCode) {
            return true;
        }

        return this.getRightsUser().includes(rightCode);
    }
    getFileIcon(fileType: string): string {
        fileType = fileType?.toLowerCase() || '';
        if (fileType === 'application/pdf') return 'img/pdf.png';
        if (['application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(fileType)) return 'img/word.png';
        if (['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(fileType)) return 'img/excel.png';
        if (['application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'].includes(fileType)) return 'img/powerpoint.png';
        if (fileType.startsWith('video/')) return 'img/multimedia.png';
        if (fileType.startsWith('audio/')) return 'img/audio.png';
        if (fileType.startsWith('image/')) return 'img/image.png';
        return 'img/file.png';
    }

    hasAnyRight(rightCodes: string[] | string): boolean {
        const rights = Array.isArray(rightCodes)
            ? rightCodes.filter(Boolean)
            : [rightCodes].filter(Boolean);

        if (rights.length === 0) {
            return true;
        }

        const userRights = this.getRightsUser();
        return rights.some(right => userRights.includes(right));
    }

    getShortFileName(text: string, maxLength: number): string {
    if (!text || text.length <= maxLength) return text;

    const extensionIndex = text.lastIndexOf('.');
    const extension = extensionIndex !== -1 ? text.slice(extensionIndex) : '';
    const baseName = text.slice(0, extensionIndex);

    const allowedLength = maxLength - extension.length - 3; // -3 for "..."
    const shortened = baseName.slice(0, allowedLength);

    return `${shortened}...${extension}`;
  }


    extractFilename(disposition: string | null): string | null {
        const match = disposition?.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        return match ? decodeURIComponent(match[1].replace(/['"]/g, '')) : null;
    }

    formatDateToSendServer(input: any): string {
        if (!input) return "";

        const d = input instanceof Date ? input : new Date(input);
        if (isNaN(d.getTime())) return "";

        const pad = (n: number) => String(n).padStart(2, '0');

        const year = d.getFullYear();
        const month = pad(d.getMonth() + 1);
        const day = pad(d.getDate());
        const hours = pad(d.getHours());     // 0–23 (24h)
        const minutes = pad(d.getMinutes());
        const seconds = pad(d.getSeconds());

        // offset phút so với UTC
        const offsetMin = -d.getTimezoneOffset();
        const sign = offsetMin >= 0 ? '+' : '-';
        const offH = pad(Math.floor(Math.abs(offsetMin) / 60));
        const offM = pad(Math.abs(offsetMin) % 60);

        // Trả về: yyyy-MM-ddTHH:mm:ss+07:00
        return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${sign}${offH}:${offM}`;
    }
      collapse(array: any[], data: any, $event: boolean): void {
    if (!$event) {
      if (data.children) {
        data.children.forEach((d: { key: any; }) => {
          const target = array.find(a => a.key === d.key)!;
          target.expand = false;
          this.collapse(array, target, false);
        });
      } else {
        return;
      }
    }
  }

    buildTree(data: any[]): any[] {
        const tree: any[] = [];
        const lookup: { [key: string]: any } = {};

        data.forEach(item => {
        lookup[item.key] = { ...item, children: [] };
        });

        data.forEach(item => {
        const node = lookup[item.key];
        if (item.keyParent && lookup[item.keyParent]) {
            lookup[item.keyParent].children.push(node);
            node.parent = lookup[item.keyParent];
        } else {
            tree.push(node);
        }
        });

        return tree;
    }

    convertTreeToList(root: any): any[] {
        const stack: any[] = [];
        const array: any[] = [];
        const hashMap = {};
        stack.push({ ...root, level: 0, expand: true });

        while (stack.length !== 0) {
        const node = stack.pop()!;
        this.visitNode(node, hashMap, array);
        if (node.children) {
            for (let i = node.children.length - 1; i >= 0; i--) {
            stack.push({
                ...node.children[i],
                level: node.level! + 1,
                expand: false,
                parent: node
            });
            }
        }
        }

        return array;
    }
    visitNode(node: any, hashMap: { [key: string]: boolean }, array: any[]): void {
        if (!hashMap[node.key]) {
        hashMap[node.key] = true;
        array.push(node);
        }
    }

    getLoading(): Observable<boolean> {
        return this._loading.getLoading();
    }

    setLoading(newValue: boolean): void {
        this._loading.setLoading(newValue);
    }

    getShortenText(text: string, maxLength: number): string {
        return text?.length > maxLength ? text.slice(0, maxLength) + '...' : text;
    }
}

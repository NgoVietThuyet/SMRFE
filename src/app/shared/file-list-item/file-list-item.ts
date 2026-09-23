import { Component, input, output } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';

export interface FileAction {
    label: string;
    icon: string;
    danger?: boolean;
}

// =====================================================
// FileListItem — hiển thị một tài liệu trong danh sách
// Dùng trong: Dashboard Recent Documents
// =====================================================
@Component({
    selector: 'smr-file-list-item',
    templateUrl: './file-list-item.html',
    styleUrl: './file-list-item.scss',
    imports: [CommonModule, NzIconModule, NzDropdownModule, NzMenuModule, NzTooltipModule, DatePipe],
})
export class FileListItem {
    fileName = input.required<string>();
    fileType = input<string>('');
    uploadedBy = input<string>('');
    uploadedAt = input<string>('');
    actions = input<FileAction[]>([
        { label: 'Xem', icon: 'eye' },
        { label: 'Tải xuống', icon: 'download' },
    ]);

    view = output<void>();
    download = output<void>();
    actionClick = output<string>();

    readonly iconMap: Record<string, string> = {
        docx: 'file-word',
        doc: 'file-word',
        xlsx: 'file-excel',
        xls: 'file-excel',
        pptx: 'file-ppt',
        ppt: 'file-ppt',
        pdf: 'file-pdf',
        txt: 'file-text',
    };

    getIcon(): string {
        const ext = (this.fileType() || this.getExt()).toLowerCase();
        return this.iconMap[ext] ?? 'file';
    }

    getIconColor(): string {
        const ext = (this.fileType() || this.getExt()).toLowerCase();
        const colorMap: Record<string, string> = {
            docx: '#2563EB', doc: '#2563EB',
            xlsx: '#16A34A', xls: '#16A34A',
            pptx: '#D97706', ppt: '#D97706',
            pdf: '#DC2626',
            txt: '#094A3B',
        };
        return colorMap[ext] ?? '#475569';
    }

    private getExt(): string {
        const name = this.fileName();
        const dot = name.lastIndexOf('.');
        return dot >= 0 ? name.slice(dot + 1) : '';
    }

    onAction(label: string): void {
        this.actionClick.emit(label);
    }
}

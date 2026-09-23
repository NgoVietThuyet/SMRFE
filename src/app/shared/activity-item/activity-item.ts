import { Component, input } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { NzIconModule } from 'ng-zorro-antd/icon';

// =====================================================
// ActivityItem — hiển thị một hoạt động trong feed
// Dùng trong: Dashboard Recent Activity
// =====================================================
@Component({
    selector: 'smr-activity-item',
    templateUrl: './activity-item.html',
    styleUrl: './activity-item.scss',
    imports: [CommonModule, NzIconModule, DatePipe],
})
export class ActivityItem {
    actorName = input.required<string>();
    action = input.required<string>();   // "đã tạo cuộc họp", "đã tải lên tài liệu", v.v.
    targetName = input.required<string>();
    targetType = input<string>('');
    occurredAt = input<string>('');      // ISO 8601

    readonly iconMap: Record<string, string> = {
        meeting: 'calendar',
        document: 'file-text',
        member: 'user',
    };

    getActivityIcon(): string {
        return this.iconMap[this.targetType()] ?? 'clock-circle';
    }
}

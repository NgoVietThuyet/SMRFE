import { Component, Input } from '@angular/core';
import { GlobalService } from '../../../core/services/global.service';
import { SharedModules } from '../../ng-zorro.module';

/**
 * Hiển thị ảnh đại diện tài khoản (nếu đã cấu hình), ngược lại chữ cái + màu như trước.
 */
@Component({
  selector: 'app-user-avatar',
  standalone: true,
  imports: [SharedModules],
  template: `
    @if (isGroup) {
      <nz-avatar
        [nzIcon]="groupIcon"
        [nzSize]="size"
        [ngStyle]="{ 'background-color': '#1890ff', color: '#fff' }">
      </nz-avatar>
    } @else {
      <nz-avatar
        [nzSrc]="avatarUrl || undefined"
        [nzText]="avatarUrl ? undefined : initials"
        [nzSize]="size"
        [ngStyle]="avatarUrl ? {} : avatarFallbackStyle">
      </nz-avatar>
    }
  `,
})
export class UserAvatarComponent {
  @Input() userName?: string | null;
  @Input() fullName?: string | null;
  @Input() avatarFileId?: string | null;
  @Input() size: number | 'large' | 'small' | 'default' = 'default';
  @Input() isGroup = false;
  @Input() groupIcon = 'team';
  @Input() cacheBust?: string | number;

  constructor(private global: GlobalService) {}

  get avatarUrl(): string | null {
    return this.global.getAccountAvatarUrl(
      this.userName,
      this.avatarFileId,
      this.cacheBust,
    );
  }

  get initials(): string {
    return this.global.getInitialsAvatar(this.fullName || this.userName || '');
  }

  get avatarFallbackStyle(): Record<string, string | number> {
    return {
      'background-color': this.global.getAvatarColor(this.userName || this.fullName || ''),
      color: '#fff',
      'font-weight': 600,
    };
  }
}

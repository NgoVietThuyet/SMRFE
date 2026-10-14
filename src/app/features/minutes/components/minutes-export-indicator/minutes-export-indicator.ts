import { Component } from '@angular/core';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { MinutesExportService } from '../../services/minutes-export.service';

/** Chỉ báo nhỏ ở góc màn hình khi còn job "Tải biên bản họp" đang chạy ngầm. */
@Component({
  selector: 'app-minutes-export-indicator',
  standalone: true,
  imports: [SharedModules],
  template: `
    @if (exports.pending().length; as n) {
    <div class="indicator" role="status" aria-live="polite" nz-tooltip [nzTooltipTitle]="names">
      <nz-icon nzType="loading" /> Đang tổng hợp biên bản ({{ n }})
    </div>
    }
  `,
  styles: [`
    .indicator {
      position: fixed; right: 20px; bottom: 20px; z-index: 1000;
      background: #fff; border: 1px solid #d9d9d9; border-radius: 20px; padding: 6px 14px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12); font-size: 13px; display: flex; align-items: center; gap: 8px;
    }
  `],
})
export class MinutesExportIndicator {
  constructor(readonly exports: MinutesExportService) { }

  get names(): string {
    return this.exports.pending().map(p => p.meetingName).join(', ');
  }
}

import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { Subject, finalize, takeUntil } from 'rxjs';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { MINUTES_STATUS_META, MinutesDetail, MinutesStatus } from '../../models/minutes.models';
import { MinutesService, saveBlob } from '../../services/minutes.service';
import { MinutesExportActions } from '../minutes-export-actions/minutes-export-actions';

/** Tab "Biên bản và ghi hình" trong chi tiết cuộc họp (P9): trạng thái biên bản + lối vào trình soạn (P13) và Trợ lý AI (P14). */
@Component({
  selector: 'app-minutes-summary',
  standalone: true,
  imports: [SharedModules, MinutesExportActions],
  template: `
    <nz-spin [nzSpinning]="loading">
      @if (detail; as d) {
      <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
        <nz-descriptions-item nzTitle="Transcript">
          {{ d.transcriptCount ? d.transcriptCount + ' đoạn' : 'Chưa có (bật phụ đề trong phòng họp để ghi lại)' }}
        </nz-descriptions-item>
        <nz-descriptions-item nzTitle="Biên bản">
          @if (d.current; as c) {
          <nz-tag [nzColor]="meta[c.status].color">{{ meta[c.status].label }}</nz-tag>
          Phiên bản {{ c.version }} · {{ c.source === 'AI' ? 'AI tạo' : 'Soạn tay' }}
          } @else {
          {{ d.canEdit ? 'Chưa tạo' : 'Chưa phát hành' }}
          }
        </nz-descriptions-item>
        @if (d.current && d.current.content.summary) {
        <nz-descriptions-item nzTitle="Tóm tắt"><div class="summary">{{ d.current.content.summary }}</div></nz-descriptions-item>
        }
      </nz-descriptions>
      <div class="export">
        <app-minutes-export-actions [meetingId]="d.meetingId" [meetingName]="d.meetingName"></app-minutes-export-actions>
      </div>
      <div class="actions">
        <button nz-button nzType="primary" [routerLink]="['/minutes', d.meetingId]">
          <nz-icon nzType="file-text" /> {{ d.canEdit ? 'Mở trình soạn biên bản' : 'Xem biên bản' }}
        </button>
        <button nz-button [routerLink]="['/ai-assistant']" [queryParams]="{ meetingId: d.meetingId }">
          <nz-icon nzType="robot" /> Hỏi Trợ lý AI
        </button>
      </div>
      } @else if (!loading) {
      <nz-empty nzNotFoundContent="Không tải được thông tin biên bản"></nz-empty>
      }
    </nz-spin>
  `,
  styles: [`
    .export { margin-top: 16px; }
    .actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
    .summary { white-space: pre-wrap; }
  `],
})
export class MinutesSummary implements OnChanges, OnDestroy {
  @Input({ required: true }) meetingId!: string;
  private destroy$ = new Subject<void>();
  readonly meta = MINUTES_STATUS_META;
  readonly Status = MinutesStatus;
  detail: MinutesDetail | null = null;
  loading = false;

  constructor(private service: MinutesService) { }

  ngOnChanges(): void {
    if (!this.meetingId) return;
    this.loading = true;
    this.service.detail(this.meetingId).pipe(finalize(() => this.loading = false), takeUntil(this.destroy$)).subscribe({
      next: d => this.detail = d,
      error: () => this.detail = null,
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  download(): void {
    const c = this.detail?.current;
    if (c) this.service.docx(this.meetingId, c.version).subscribe(({ blob, fileName }) => saveBlob(blob, fileName));
  }
}

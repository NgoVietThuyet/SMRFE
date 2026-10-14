import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil } from 'rxjs';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { SessionService } from '../../../../core';
import { DashboardService } from '../../services/dashboard.service';
import { UserSearchItem } from '../../models/dashboard.models';

/** Modal "Họp nhanh" (Plan P8 §4.6): POST /api/Meeting/quick → BE tạo cuộc họp trạng thái 2 và gửi lời mời. */
@Component({
  selector: 'app-quick-meeting-modal',
  standalone: true,
  imports: [SharedModules],
  template: `
    <nz-modal [nzVisible]="visible" nzTitle="HỌP NHANH" [nzFooter]="footer" (nzOnCancel)="close()"
      [nzMaskClosable]="!isSubmitting">
      <ng-container *nzModalContent>
        <label class="text-control" for="quick-name">Tên cuộc họp <span class="required-star">*</span></label>
        <input id="quick-name" nz-input class="space-control" maxlength="200" [(ngModel)]="name"
          (keydown.enter)="submit()" />
        @if (nameError) {
        <div class="field-error">{{ nameError }}</div>
        }

        <label class="text-control">Mời người tham gia</label>
        <nz-select class="space-control full-width" nzMode="multiple" nzShowSearch nzServerSearch nzAllowClear
          nzPlaceHolder="Gõ tên hoặc email để tìm" [nzLoading]="searching" [(ngModel)]="participants"
          (nzOnSearch)="search$.next($event)" aria-label="Mời người tham gia">
          @for (u of options; track u.userName) {
          <nz-option [nzValue]="u.userName" [nzLabel]="u.fullName + ' · ' + u.email"></nz-option>
          }
        </nz-select>
        <div class="hint">Có thể mời thêm sau khi đã vào phòng.</div>
      </ng-container>
      <ng-template #footer>
        <button nz-button (click)="close()" [disabled]="isSubmitting">Huỷ</button>
        <button nz-button nzType="primary" [nzLoading]="isSubmitting" (click)="submit()">
          <nz-icon nzType="thunderbolt" /> Bắt đầu ngay
        </button>
      </ng-template>
    </nz-modal>
  `,
  styles: [`
    .full-width { width: 100%; }
    .hint { color: #8c8c8c; font-size: 12px; }
  `],
})
export class QuickMeetingModal implements OnInit, OnChanges, OnDestroy {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() created = new EventEmitter<string>();

  private destroy$ = new Subject<void>();
  readonly search$ = new Subject<string>();

  name = '';
  nameError = '';
  participants: string[] = [];
  options: UserSearchItem[] = [];
  searching = false;
  isSubmitting = false;

  constructor(private service: DashboardService, private session: SessionService) { }

  ngOnInit(): void {
    const me = (this.session.accountInfo?.userName ?? '').toLowerCase();
    this.search$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(q => {
          this.searching = true;
          return this.service.searchUsers(q.trim(), 10).pipe(finalize(() => this.searching = false));
        }),
        takeUntil(this.destroy$),
      )
      .subscribe(list => {
        const selected = this.options.filter(o => this.participants.includes(o.userName));
        const fresh = (list ?? []).filter(u => u.userName.toLowerCase() !== me);
        // Giữ lại người đã chọn để nhãn không mất khi kết quả tìm kiếm đổi.
        this.options = [...selected, ...fresh.filter(u => !selected.some(s => s.userName === u.userName))];
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue) {
      this.reset();
    }
  }

  private reset(): void {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    this.name = `Họp nhanh ${pad(now.getHours())}:${pad(now.getMinutes())} ${pad(now.getDate())}/${pad(now.getMonth() + 1)}`;
    this.nameError = '';
    this.participants = [];
    this.options = [];
    this.isSubmitting = false;
  }

  submit(): void {
    if (this.isSubmitting) return;
    const name = this.name.trim();
    if (!name) {
      this.nameError = 'Vui lòng nhập tên cuộc họp';
      return;
    }
    this.nameError = '';
    this.isSubmitting = true;
    this.service.quickMeeting(name, this.participants)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: meeting => this.created.emit(meeting.id),
        error: () => this.isSubmitting = false,
      });
  }

  close(): void {
    if (this.isSubmitting) return;
    this.visibleChange.emit(false);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

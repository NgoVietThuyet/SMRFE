import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { Subject, debounceTime, filter, finalize, takeUntil } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { SharedModules } from '../../../../../shared/ng-zorro.module';
import { RealtimeHubService } from '../../../../../shared/services';
import { MeetingPoll } from '../../../models/room.models';
import { RoomService } from '../../../services/room.service';

const DEFAULT_OPTIONS = ['Đồng ý', 'Không đồng ý', 'Bỏ phiếu trắng'];

/**
 * Panel Biểu quyết trong phòng họp. Chủ trì / đồng chủ trì / thư ký tạo và đóng; thành viên có tài khoản bỏ phiếu
 * (đổi phiếu được đến khi đóng); khách chỉ xem. Kết quả cập nhật tức thì qua sự kiện hub PollChanged.
 * Kết quả (số phiếu) được đưa vào AI khi tổng hợp biên bản.
 */
@Component({
  selector: 'app-room-polls-panel',
  standalone: true,
  imports: [SharedModules],
  template: `
    @if (canCreate) {
    <button nz-button nzType="primary" nzBlock (click)="openCreate()"><nz-icon nzType="plus" /> Tạo biểu quyết</button>
    <div class="hint">Kết quả biểu quyết được đưa vào biên bản AI khi tổng hợp.</div>
    }
    @if (!loaded) { <nz-spin nzSimple class="spin"></nz-spin> }
    @else if (!polls.length) { <nz-empty nzNotFoundContent="Chưa có biểu quyết nào"></nz-empty> }
    @for (p of polls; track p.id) {
    <div class="poll" [class.closed]="p.closed">
      <div class="q">{{ p.question }}</div>
      <div class="meta">
        <nz-tag [nzColor]="p.closed ? 'default' : 'processing'">{{ p.closed ? 'Đã đóng' : 'Đang mở' }}</nz-tag>
        <nz-tag>{{ p.anonymous ? 'Ẩn danh' : 'Công khai' }}</nz-tag>
        <span>{{ p.total }} phiếu · {{ p.createdByName }}</span>
      </div>
      @for (o of p.options; track $index) {
      <button class="opt" [class.mine]="p.myVote === $index" [class.win]="p.closed && p.winner === $index"
        [disabled]="p.closed || isGuest" (click)="vote(p, $index)">
        <span class="bar" [style.width.%]="percent(p, $index)"></span>
        <span class="label">
          @if (p.myVote === $index) { <nz-icon nzType="check-circle" nzTheme="fill" /> }
          {{ o }}
        </span>
        <span class="count">{{ p.counts[$index] }} ({{ percent(p, $index) }}%)</span>
      </button>
      @if (p.voters && p.voters[$index]?.length) {
      <div class="voters">{{ p.voters[$index].join(', ') }}</div>
      }
      }
      @if (p.closed) {
      <div class="result">
        @if (p.total === 0) { Không ai bỏ phiếu. }
        @else if (p.winner >= 0) { Kết quả: <b>{{ p.options[p.winner] }}</b> }
        @else { Hòa phiếu, chưa có phương án thắng. }
      </div>
      }
      @if (p.canClose) {
      <button nz-button nzSize="small" nz-popconfirm nzPopconfirmTitle="Đóng biểu quyết này? Sau khi đóng không ai bỏ phiếu được nữa."
        (nzOnConfirm)="close(p)"><nz-icon nzType="lock" /> Đóng biểu quyết</button>
      }
      @if (isGuest && !p.closed) { <div class="hint">Khách chỉ xem, không bỏ phiếu.</div> }
    </div>
    }

    <nz-modal [(nzVisible)]="createVisible" nzTitle="TẠO BIỂU QUYẾT" nzOkText="Tạo và mở bỏ phiếu" nzCancelText="Huỷ"
      [nzOkLoading]="creating" [nzOkDisabled]="!canSubmit" (nzOnOk)="create()" (nzOnCancel)="createVisible = false">
      <ng-container *nzModalContent>
        <label class="field">Câu hỏi biểu quyết <span class="req">*</span></label>
        <textarea nz-input rows="2" maxlength="300" [(ngModel)]="question" placeholder="VD: Chọn phương án triển khai nào?"
          aria-label="Câu hỏi biểu quyết"></textarea>
        <label class="field">Các phương án (2 – 8)</label>
        @for (o of options; track $index) {
        <div class="opt-row">
          <input nz-input maxlength="120" [ngModel]="options[$index]" (ngModelChange)="options[$index] = $event"
            [attr.aria-label]="'Phương án ' + ($index + 1)" />
          <button nz-button nzType="text" nzDanger [disabled]="options.length <= 2" (click)="removeOption($index)"
            aria-label="Xóa phương án"><nz-icon nzType="delete" /></button>
        </div>
        }
        <button nz-button nzType="dashed" nzBlock [disabled]="options.length >= 8" (click)="addOption()">
          <nz-icon nzType="plus" /> Thêm phương án
        </button>
        <div class="anon">
          <nz-switch [(ngModel)]="anonymous"></nz-switch>
          <span>Bỏ phiếu ẩn danh <small>(chỉ hiện số phiếu, không hiện ai chọn gì)</small></span>
        </div>
      </ng-container>
    </nz-modal>
  `,
  styles: [`
    :host { display: block; }
    .spin { display: block; margin: 24px auto; }
    .hint { font-size: 12px; color: #8c8c8c; padding: 4px 2px 8px; }
    .poll { border: 1px solid #f0f0f0; border-radius: 8px; padding: 10px; margin: 8px 0; }
    .poll.closed { background: #fafafa; }
    .q { font-weight: 600; margin-bottom: 4px; }
    .meta { font-size: 12px; color: #8c8c8c; display: flex; flex-wrap: wrap; gap: 4px; align-items: center; margin-bottom: 8px; }
    .opt { position: relative; display: flex; justify-content: space-between; align-items: center; gap: 8px; width: 100%; text-align: left;
      border: 1px solid #d9d9d9; border-radius: 6px; background: #fff; padding: 6px 10px; margin-top: 6px; cursor: pointer; overflow: hidden; }
    .opt:disabled { cursor: default; }
    .opt.mine { border-color: #1677ff; }
    .opt.win { border-color: #52c41a; }
    .opt .bar { position: absolute; inset: 0 auto 0 0; background: #e6f4ff; z-index: 0; transition: width .25s; }
    .opt.win .bar { background: #f6ffed; }
    .opt .label, .opt .count { position: relative; z-index: 1; }
    .opt .count { font-size: 12px; color: #595959; white-space: nowrap; }
    .voters { font-size: 12px; color: #8c8c8c; padding: 2px 4px 0; }
    .result { margin: 8px 0 2px; }
    .field { display: block; font-weight: 500; margin: 12px 0 4px; }
    .req { color: #ff4d4f; }
    .opt-row { display: flex; gap: 4px; margin-bottom: 6px; }
    .opt-row input { flex: 1; min-width: 0; }
    .anon { display: flex; align-items: center; gap: 8px; margin-top: 14px; }
    .anon small { color: #8c8c8c; }
  `],
})
export class RoomPollsPanel implements OnInit, OnDestroy {
  @Input({ required: true }) meetingId = '';
  @Input() isGuest = false;
  /** Số biểu quyết đang mở mà mình chưa bỏ phiếu (badge ở thanh điều khiển). */
  @Output() pending = new EventEmitter<number>();

  polls: MeetingPoll[] = [];
  canCreate = false;
  loaded = false;

  createVisible = false;
  creating = false;
  question = '';
  options: string[] = [...DEFAULT_OPTIONS];
  anonymous = false;

  private destroy$ = new Subject<void>();

  constructor(private rooms: RoomService, private hub: RealtimeHubService, private message: NzMessageService) { }

  ngOnInit(): void {
    this.load();
    this.hub.roomEvent
      .pipe(filter(e => e.name === 'PollChanged' && e.payload?.meetingId === this.meetingId), debounceTime(200), takeUntil(this.destroy$))
      .subscribe(() => this.load());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get canSubmit(): boolean {
    return !!this.question.trim() && this.options.filter(o => o.trim()).length >= 2;
  }

  load(): void {
    this.rooms.polls(this.meetingId).pipe(takeUntil(this.destroy$)).subscribe({
      next: res => {
        this.polls = [...(res?.polls ?? [])].reverse();   // mới nhất lên đầu
        this.canCreate = !!res?.canCreate;
        this.loaded = true;
        this.pending.emit(this.isGuest ? 0 : this.polls.filter(p => !p.closed && p.myVote == null).length);
      },
      error: () => this.loaded = true,
    });
  }

  percent(p: MeetingPoll, i: number): number {
    return p.total ? Math.round((p.counts[i] * 100) / p.total) : 0;
  }

  vote(p: MeetingPoll, index: number): void {
    if (p.closed || this.isGuest) return;
    this.rooms.vote(this.meetingId, p.id, index).pipe(takeUntil(this.destroy$)).subscribe(() => this.load());
  }

  close(p: MeetingPoll): void {
    this.rooms.closePoll(this.meetingId, p.id).pipe(takeUntil(this.destroy$)).subscribe(() => this.load());
  }

  openCreate(): void {
    this.question = '';
    this.options = [...DEFAULT_OPTIONS];
    this.anonymous = false;
    this.createVisible = true;
  }

  addOption(): void {
    if (this.options.length < 8) this.options = [...this.options, ''];
  }

  removeOption(i: number): void {
    if (this.options.length > 2) this.options = this.options.filter((_, k) => k !== i);
  }

  create(): void {
    if (!this.canSubmit || this.creating) return;
    this.creating = true;
    this.rooms.createPoll(this.meetingId, this.question.trim(), this.options.map(o => o.trim()).filter(Boolean), this.anonymous)
      .pipe(finalize(() => this.creating = false), takeUntil(this.destroy$))
      .subscribe(() => {
        this.createVisible = false;
        this.message.success('Đã mở biểu quyết');
        this.load();
      });
  }
}

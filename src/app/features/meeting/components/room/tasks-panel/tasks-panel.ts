import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subject, debounceTime, filter, finalize, merge, takeUntil } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { SharedModules } from '../../../../../shared/ng-zorro.module';
import { RealtimeHubService } from '../../../../../shared/services';
import { DateTimeUtils } from '../../../../../shared/utils';
import { TaskListItem } from '../../../../dashboard/models/dashboard.models';
import { MeetingService } from '../../../services/meeting.service';

const STATUS: Record<number, { label: string; color: string }> = {
  0: { label: 'Chưa bắt đầu', color: 'default' },
  1: { label: 'Đang làm', color: 'processing' },
  2: { label: 'Hoàn thành', color: 'success' },
};

/**
 * Panel Công việc của cuộc họp. Không hiện cho khách.
 * Tạo việc ngay trong phòng (vào bảng chung của cuộc họp); bấm một việc → trang chi tiết Task mở ở tab trình duyệt mới,
 * tab phòng họp giữ nguyên nên cuộc họp vẫn diễn ra song song.
 */
@Component({
  selector: 'app-room-tasks-panel',
  standalone: true,
  imports: [SharedModules],
  template: `
    @if (canCreate) {
    <div class="create">
      <input nz-input placeholder="Tên công việc mới" aria-label="Tên công việc mới" maxlength="300" [(ngModel)]="newTitle"
        [disabled]="creating" (keydown.enter)="create()" />
      <button nz-button nzType="primary" [nzLoading]="creating" [disabled]="!newTitle.trim()" (click)="create()">
        <nz-icon nzType="plus" /> Tạo công việc
      </button>
    </div>
    <div class="hint">Bấm vào công việc để mở trang chi tiết ở tab mới — cuộc họp vẫn tiếp tục ở tab này.</div>
    }
    @if (!loaded) { <nz-spin nzSimple class="spin"></nz-spin> }
    @else if (!tasks.length) { <nz-empty nzNotFoundContent="Cuộc họp chưa có công việc"></nz-empty> }
    @for (t of tasks; track t.id) {
    <a class="task" [class.fresh]="t.id === freshId" [routerLink]="['/tasks']" [queryParams]="{ focus: t.id }" target="_blank"
      rel="noopener">
      <div class="title">{{ t.title }}</div>
      <div class="meta">
        <nz-tag [nzColor]="status[t.status]?.color">{{ status[t.status]?.label }}</nz-tag>
        <span>{{ t.assigneeFullName || t.assigneeUserName || 'Chưa giao' }}</span>
        @if (t.dueDate) { <span [class.late]="late(t)">· {{ time(t.dueDate) | date: 'HH:mm dd/MM' }}</span> }
      </div>
    </a>
    }
  `,
  styles: [`
    :host { display: block; }
    .spin { display: block; margin: 24px auto; }
    .task { display: block; padding: 8px 6px; border-bottom: 1px solid #f5f5f5; color: inherit; }
    .task:hover { background: #fafafa; }
    .task.fresh { background: #e6f4ff; }
    .create { display: flex; gap: 8px; padding: 4px 0 6px; }
    .create input { flex: 1; min-width: 0; }
    .hint { font-size: 12px; color: #8c8c8c; padding: 0 2px 8px; border-bottom: 1px solid #f0f0f0; }
    .title { font-weight: 500; }
    .meta { font-size: 12px; color: #8c8c8c; display: flex; gap: 4px; align-items: center; margin-top: 2px; }
    .late { color: #ff4d4f; }
  `],
})
export class RoomTasksPanel implements OnInit, OnDestroy {
  @Input({ required: true }) meetingId = '';
  /** Ẩn với cuộc họp đã hủy / lưu trữ (khách không có panel này). */
  @Input() canCreate = true;

  newTitle = '';
  creating = false;
  /** Việc vừa tạo — tô nổi vài giây để dễ thấy và bấm vào. */
  freshId: string | null = null;

  private destroy$ = new Subject<void>();
  readonly status = STATUS;
  tasks: TaskListItem[] = [];
  loaded = false;

  constructor(private meetings: MeetingService, private hub: RealtimeHubService, private message: NzMessageService) { }

  ngOnInit(): void {
    this.load();
    merge(
      this.hub.roomEvent.pipe(filter(e => e.name === 'TaskChanged' && e.payload?.meetingId === this.meetingId)),
      this.hub.notificationCreated.pipe(filter(e => !!e?.notification?.type?.startsWith('TASK_'))),
    ).pipe(debounceTime(500), takeUntil(this.destroy$)).subscribe(() => this.load());
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.meetings.tasks(this.meetingId).pipe(takeUntil(this.destroy$)).subscribe({
      next: res => {
        // Chỉ hiện việc: bỏ cột (cấp 1) và bảng (cấp 0 có cột bên trong hoặc là bảng chung vừa tạo, chưa có cột).
        const items = (res?.items ?? []) as (TaskListItem & { level?: number; parentId?: string | null; sourceRef?: string | null })[];
        const parents = new Set(items.map(t => t.parentId).filter(Boolean));
        this.tasks = items.filter(t => t.level !== 1 && !parents.has(t.id) && !t.sourceRef?.includes('-board:'));
        this.loaded = true;
      },
      error: () => this.loaded = true,
    });
  }

  create(): void {
    const title = this.newTitle.trim();
    if (!title || this.creating) return;
    this.creating = true;
    this.meetings.createCard(this.meetingId, title).pipe(finalize(() => this.creating = false), takeUntil(this.destroy$)).subscribe(res => {
      this.newTitle = '';
      this.freshId = res.cardId;
      setTimeout(() => { if (this.freshId === res.cardId) this.freshId = null; }, 6000);
      this.message.success('Đã tạo công việc. Bấm vào công việc để mở trang chi tiết.');
      this.load();
    });
  }

  time(v: string | null): Date | null {
    return DateTimeUtils.fromUtc(v);
  }

  late(t: TaskListItem): boolean {
    const d = DateTimeUtils.fromUtc(t.dueDate);
    return !!d && t.status !== 2 && d.getTime() < Date.now();
  }
}

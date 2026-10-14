import { Component, Input, OnDestroy, OnInit } from '@angular/core';
import { Subject, debounceTime, filter, merge, takeUntil } from 'rxjs';
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

/** Panel Công việc của cuộc họp (chỉ xem; tạo/sửa ở trang Công việc — P12). Không hiện cho khách. */
@Component({
  selector: 'app-room-tasks-panel',
  standalone: true,
  imports: [SharedModules],
  template: `
    @if (!loaded) { <nz-spin nzSimple class="spin"></nz-spin> }
    @else if (!tasks.length) { <nz-empty nzNotFoundContent="Cuộc họp chưa có công việc"></nz-empty> }
    @for (t of tasks; track t.id) {
    <a class="task" [routerLink]="['/tasks']" [queryParams]="{ focus: t.id }" target="_blank">
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
    .title { font-weight: 500; }
    .meta { font-size: 12px; color: #8c8c8c; display: flex; gap: 4px; align-items: center; margin-top: 2px; }
    .late { color: #ff4d4f; }
  `],
})
export class RoomTasksPanel implements OnInit, OnDestroy {
  @Input({ required: true }) meetingId = '';

  private destroy$ = new Subject<void>();
  readonly status = STATUS;
  tasks: TaskListItem[] = [];
  loaded = false;

  constructor(private meetings: MeetingService, private hub: RealtimeHubService) { }

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
        this.tasks = res?.items ?? [];
        this.loaded = true;
      },
      error: () => this.loaded = true,
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

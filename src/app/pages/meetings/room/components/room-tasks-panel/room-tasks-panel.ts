import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { MeetingHubService } from '../../../../../core/services/meeting-hub.service';
import { TaskService } from '../../../../../core/services/task.service';
import { TaskCreateModal } from '../../../../tasks/components/task-create-modal/task-create-modal';
import { TaskListItem, TaskPriority, TaskStatus } from '../../../../../core/models/task.models';
import { RoomKey, RoomLang, ROOM_I18N } from '../../room-i18n';

// =====================================================
// RoomTasksPanel — công việc của cuộc họp trong Meeting Room.
// List gọn (tiêu đề + phụ trách + hạn + status dot) + tạo nhanh
// qua TaskCreateModal với meetingId khóa sẵn. Realtime: hub
// taskChanged → reload (MeetingRoom đã join room sẵn).
// =====================================================
@Component({
    selector: 'app-room-tasks-panel',
    templateUrl: './room-tasks-panel.html',
    imports: [CommonModule, NzButtonModule, NzEmptyModule, NzIconModule, NzSpinModule, TaskCreateModal],
})
export class RoomTasksPanel implements OnInit {
    private readonly taskService = inject(TaskService);
    private readonly hub = inject(MeetingHubService);
    private readonly destroyRef = inject(DestroyRef);

    meetingId = input.required<string>();
    lang = input<RoomLang>('vi');

    tasks = signal<TaskListItem[]>([]);
    loading = signal<boolean>(true);
    loadError = signal<boolean>(false);
    createOpen = signal<boolean>(false);

    t(key: RoomKey): string {
        return ROOM_I18N[this.lang()][key];
    }

    ngOnInit(): void {
        this.load();
    }

    constructor() {
        // Task của cuộc họp vừa tạo/sửa/xóa (kể cả từ browser khác) → tải lại
        this.hub.taskChanged
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe((e) => {
                if (e.meetingId === this.meetingId()) this.load();
            });
    }

    load(): void {
        this.loading.set(true);
        this.loadError.set(false);
        this.taskService
            .query({
                shortcut: 'all',
                keyword: '',
                meetingId: this.meetingId(),
                assignee: null,
                status: null,
                priority: null,
                page: 1,
                pageSize: 50,
            })
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (result) => {
                    this.tasks.set(result.items ?? []);
                    this.loading.set(false);
                },
                error: () => {
                    this.loading.set(false);
                    this.loadError.set(true);
                },
            });
    }

    statusClass(status: number): string {
        const map: Record<number, string> = {
            [TaskStatus.NotStarted]: 'draft',
            [TaskStatus.InProgress]: 'ongoing',
            [TaskStatus.Completed]: 'ended',
        };
        return map[status] ?? 'draft';
    }

    // Màu hạn: chỉ tô màu chữ (quá hạn đỏ, ≤48h cam, còn lại xám) — pattern trang Tasks
    dueClass(task: TaskListItem): string {
        if (!task.dueDate || task.status === TaskStatus.Completed) return '';
        const due = new Date(task.dueDate).getTime();
        const diff = due - Date.now();
        if (diff < 0) return 'is-overdue';
        if (diff <= 48 * 3600_000) return 'is-due-soon';
        return '';
    }

    formatDue(iso: string | null): string {
        if (!iso) return '—';
        const d = new Date(iso);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        return `${day}/${month} · ${time}`;
    }

    initials(name: string | null): string {
        const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return '?';
        return ((parts[0][0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '')).toUpperCase();
    }

    priorityDot(priority: number): string {
        // Trùng màu tag ưu tiên trang Tasks
        const map: Record<number, string> = {
            [TaskPriority.Low]: '#16a34a',
            [TaskPriority.Medium]: '#d97706',
            [TaskPriority.High]: '#dc2626',
        };
        return map[priority] ?? '#64748b';
    }
}

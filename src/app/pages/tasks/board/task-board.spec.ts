import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { TaskListItem, TaskStatus } from '../../../core/models/task.models';
import { AuthService } from '../../../core/services/auth.service';
import { MeetingHubService } from '../../../core/services/meeting-hub.service';
import { MeetingService } from '../../../core/services/meeting.service';
import { TaskService } from '../../../core/services/task.service';
import { BOARD, makeTask, TEST_ICONS } from '../../../core/services/task-board.testing';
import { TaskBoard } from './task-board';

describe('TaskBoard', () => {
    let fixture: ComponentFixture<TaskBoard>;
    let cards: TaskListItem[];
    let getError: Error | null;
    let statusCalls: number;

    async function setup(): Promise<void> {
        await TestBed.configureTestingModule({
            imports: [TaskBoard, NoopAnimationsModule],
            providers: [
                provideRouter([]),
                provideNzI18n(en_US),
                provideNzDateFnsAdapter(),
                provideNzIcons(TEST_ICONS),
                {
                    provide: ActivatedRoute,
                    useValue: {
                        paramMap: new BehaviorSubject(convertToParamMap({ workId: 'w1' })),
                        queryParamMap: new BehaviorSubject(convertToParamMap({})),
                        snapshot: { firstChild: null },
                    },
                },
                {
                    provide: TaskService,
                    useValue: {
                        get: () => (getError ? throwError(() => getError) : of(BOARD)),
                        query: () => of({ items: cards, totalItems: cards.length, totalPages: 1, page: 1, pageSize: 100, summary: { total: 0, mine: 0, overdue: 0, today: 0 } }),
                        updateStatus: (id: string, status: number) => {
                            statusCalls++;
                            return of({ ...cards.find((c) => c.id === id)!, status });
                        },
                    },
                },
                { provide: MeetingHubService, useValue: { taskChanged: new Subject(), joinRoom: async () => undefined, leaveRoom: async () => undefined } },
                { provide: MeetingService, useValue: { searchUsers: () => of([]) } },
                { provide: AuthService, useValue: { currentUser: () => ({ userName: 'me', fullName: 'Tôi' }) } },
                { provide: NzMessageService, useValue: { success: () => undefined, error: () => undefined } },
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(TaskBoard);
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    }

    beforeEach(() => {
        getError = null;
        statusCalls = 0;
        cards = [
            makeTask({ id: 'c1', title: 'Tích hợp API', status: TaskStatus.NotStarted, childrenCount: 3, completedChildrenCount: 1 }),
            makeTask({ id: 'c2', title: 'Pipeline', status: TaskStatus.InProgress }),
        ];
    });

    it('hiện 3 cột và thẻ đúng cột', async () => {
        await setup();
        const el: HTMLElement = fixture.nativeElement;
        const cols = el.querySelectorAll('app-board-column');
        expect(cols.length).toBe(3);
        expect(cols[0].textContent).toContain('Tích hợp API');
        expect(cols[0].textContent).toContain('1/3');
        expect(cols[1].textContent).toContain('Pipeline');
        expect(cols[2].querySelector('.board-column__empty')).not.toBeNull();
        expect(el.querySelector('.task-board__title')?.textContent).toContain('Bảng A');
    });

    it('bảng rỗng hiện hướng dẫn', async () => {
        cards = [];
        await setup();
        expect(fixture.nativeElement.querySelector('.task-board__empty-hint')?.textContent).toContain('chưa có đầu việc');
    });

    it('404 hiện "không tồn tại", không giả làm rỗng', async () => {
        getError = new Error('Không tìm thấy công việc.');
        await setup();
        const el: HTMLElement = fixture.nativeElement;
        expect(el.textContent).toContain('Công việc không tồn tại hoặc đã bị xóa');
        expect(el.querySelector('app-board-column')).toBeNull();
    });

    it('Shift+→ chuyển thẻ sang cột kế bên và gọi 1 PATCH', async () => {
        await setup();
        const card: HTMLElement = fixture.nativeElement.querySelector('app-task-card');
        card.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }));
        await fixture.whenStable();
        fixture.detectChanges();
        expect(statusCalls).toBe(1);
        const cols = fixture.nativeElement.querySelectorAll('app-board-column');
        expect(cols[1].textContent).toContain('Tích hợp API');
    });
});

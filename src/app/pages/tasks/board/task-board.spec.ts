import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { BehaviorSubject, of, Subject, throwError } from 'rxjs';
import { CreateTaskRequest, TaskListItem, TaskSearchRequest, UpdateTaskRequest } from '../../../core/models/task.models';
import { AuthService } from '../../../core/services/auth.service';
import { MeetingHubService } from '../../../core/services/meeting-hub.service';
import { MeetingService } from '../../../core/services/meeting.service';
import { TaskService } from '../../../core/services/task.service';
import { BOARD, makeTask, pageOf, TEST_ICONS } from '../../../core/services/task-board.testing';
import { TaskBoard } from './task-board';

describe('TaskBoard', () => {
    let fixture: ComponentFixture<TaskBoard>;
    let lists: TaskListItem[];
    let cards: TaskListItem[];
    let getError: Error | null;
    let updates: UpdateTaskRequest[];
    let created: CreateTaskRequest[];

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
                        query: (q: TaskSearchRequest) =>
                            of(pageOf(q.level === 1 ? lists : cards.filter((c) => c.parentId === q.parentId))),
                        update: (id: string, p: UpdateTaskRequest) => {
                            updates.push(p);
                            return of({ ...cards.find((c) => c.id === id)!, parentId: p.parentId ?? null });
                        },
                        create: (p: CreateTaskRequest) => {
                            created.push(p);
                            return of(makeTask({ id: 'n' + created.length, level: p.level, parentId: p.parentId ?? null, title: p.title, createDate: '2026-10-09T00:00:00' }));
                        },
                    },
                },
                { provide: MeetingHubService, useValue: { taskChanged: new Subject(), joinRoom: async () => undefined, leaveRoom: async () => undefined } },
                { provide: MeetingService, useValue: { searchUsers: () => of([]) } },
                { provide: AuthService, useValue: { currentUser: () => ({ userName: 'me', fullName: 'Tôi' }) } },
                { provide: NzMessageService, useValue: { success: () => undefined, error: () => undefined, warning: () => undefined } },
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(TaskBoard);
        await settle();
    }

    async function settle(): Promise<void> {
        fixture.detectChanges();
        await fixture.whenStable();
        await new Promise((r) => setTimeout(r));
        fixture.detectChanges();
    }

    function el(): HTMLElement {
        return fixture.nativeElement;
    }

    beforeEach(() => {
        getError = null;
        updates = [];
        created = [];
        lists = [
            makeTask({ id: 'l1', level: 1, parentId: 'w1', title: 'Backend', createDate: '2026-10-01T00:00:00' }),
            makeTask({ id: 'l2', level: 1, parentId: 'w1', title: 'Frontend', createDate: '2026-10-02T00:00:00' }),
        ];
        cards = [makeTask({ id: 'c1', parentId: 'l1', title: 'Tích hợp API' })];
    });

    it('bảng mới trống: không có cột mặc định, chỉ có nút Thêm đầu việc', async () => {
        lists = [];
        cards = [];
        await setup();
        expect(el().querySelectorAll('app-board-column').length).toBe(0);
        expect(el().querySelector('.task-board__columns')?.textContent).not.toContain('Chưa bắt đầu');
        expect(el().querySelector('.task-board__add-list-btn')?.textContent).toContain('Thêm đầu việc');
    });

    it('Thêm đầu việc tạo một cột mới có tiêu đề (level 1, cha là bảng)', async () => {
        lists = [];
        cards = [];
        await setup();
        (el().querySelector('.task-board__add-list-btn') as HTMLButtonElement).click();
        await settle();
        const input = el().querySelector('.task-board__add-list input') as HTMLInputElement;
        input.value = 'Thiết kế';
        input.dispatchEvent(new Event('input'));
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        await settle();
        expect(created[0]).toEqual(expect.objectContaining({ level: 1, parentId: 'w1', title: 'Thiết kế' }));
        const cols = el().querySelectorAll('app-board-column');
        expect(cols.length).toBe(1);
        expect(cols[0].querySelector('.board-column__title')?.textContent).toContain('Thiết kế');
    });

    it('hiện các cột đầu việc kèm thẻ việc nhỏ trong thân cột', async () => {
        await setup();
        const cols = el().querySelectorAll('app-board-column');
        expect(cols.length).toBe(2);
        expect(cols[0].textContent).toContain('Backend');
        expect(cols[0].textContent).toContain('Tích hợp API');
        expect(cols[1].querySelector('.board-column__empty')).not.toBeNull();
    });

    it('404 hiện "không tồn tại", không giả làm rỗng', async () => {
        getError = new Error('Không tìm thấy công việc.');
        await setup();
        expect(el().textContent).toContain('Công việc không tồn tại hoặc đã bị xóa');
        expect(el().querySelector('.task-board__add-list')).toBeNull();
    });

    it('Shift+→ chuyển việc nhỏ sang đầu việc kế bên (PUT parentId)', async () => {
        await setup();
        const card = el().querySelector('app-task-card') as HTMLElement;
        card.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', shiftKey: true, bubbles: true }));
        await settle();
        expect(updates.length).toBe(1);
        expect(updates[0].parentId).toBe('l2');
        expect(el().querySelectorAll('app-board-column')[1].textContent).toContain('Tích hợp API');
    });
});

import { Component, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { CreateTaskRequest, TaskDetail, TaskListItem, TaskStatus } from '../../../core/models/task.models';
import { AuthService } from '../../../core/services/auth.service';
import { MeetingService } from '../../../core/services/meeting.service';
import { TaskBoardStore } from '../../../core/services/task-board.store';
import { BOARD, makeTask, TEST_ICONS } from '../../../core/services/task-board.testing';
import { TaskService } from '../../../core/services/task.service';
import { CardDetail } from './card-detail';

const SUBS = [
    makeTask({ id: 's1', parentId: 'c1', level: 2, title: 'Sửa URL', status: TaskStatus.Completed }),
    makeTask({ id: 's2', parentId: 'c1', level: 2, title: 'Viết retry' }),
];

const CARD: TaskDetail = {
    ...makeTask({ id: 'c1', title: 'Tích hợp API', childrenCount: 2, completedChildrenCount: 1 }),
    shares: [],
    children: SUBS,
};

@Component({
    imports: [CardDetail],
    providers: [TaskBoardStore],
    template: `<app-card-detail cardId="c1" />`,
})
class Host {
    readonly store = inject(TaskBoardStore);
}

describe('CardDetail', () => {
    let fixture: ComponentFixture<Host>;
    let store: TaskBoardStore;
    let statusFails: boolean;
    let created: CreateTaskRequest[];

    beforeEach(async () => {
        statusFails = false;
        created = [];
        await TestBed.configureTestingModule({
            imports: [Host, NoopAnimationsModule],
            providers: [
                provideRouter([]),
                provideNzI18n(en_US),
                provideNzDateFnsAdapter(),
                provideNzIcons(TEST_ICONS),
                {
                    provide: TaskService,
                    useValue: {
                        get: (id: string) => of(id === 'w1' ? BOARD : CARD),
                        query: () => of({ items: [makeTask({ id: 'c1', childrenCount: 2, completedChildrenCount: 1 })], totalItems: 1, totalPages: 1, page: 1, pageSize: 100, summary: { total: 1, mine: 0, overdue: 0, today: 0 } }),
                        updateStatus: (id: string, status: number) =>
                            statusFails ? throwError(() => new Error('Lỗi')) : of(makeTask({ id, parentId: 'c1', level: 2, status })),
                        create: (p: CreateTaskRequest) => {
                            created.push(p);
                            return of(makeTask({ id: 's3', parentId: p.parentId ?? null, level: 2, title: p.title }));
                        },
                    },
                },
                { provide: MeetingService, useValue: { searchUsers: () => of([]) } },
                { provide: AuthService, useValue: { currentUser: () => ({ userName: 'me', fullName: 'Tôi' }) } },
                { provide: NzMessageService, useValue: { success: () => undefined, error: () => undefined } },
            ],
        }).compileComponents();
        fixture = TestBed.createComponent(Host);
        store = fixture.componentInstance.store;
        await store.load('w1');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
    });

    function detail(): CardDetail {
        return fixture.debugElement.children[0].componentInstance as CardDetail;
    }

    function sub(id: string): TaskListItem {
        return SUBS.find((s) => s.id === id)!;
    }

    it('tick việc nhỏ cập nhật ☑ x/y trên thẻ ngay', async () => {
        await detail().toggleSubtask(sub('s2'), true);
        expect(store.card('c1')?.completedChildrenCount).toBe(2);
        expect(store.card('c1')?.childrenCount).toBe(2);
    });

    it('lỗi khi tick thì hoàn tác số đếm', async () => {
        statusFails = true;
        await detail().toggleSubtask(sub('s2'), true);
        expect(store.card('c1')?.completedChildrenCount).toBe(1);
    });

    it('thêm việc nhỏ tạo level=2, parentId=cardId', async () => {
        const d = detail() as unknown as { newSubTitle: { set(v: string): void } };
        d.newSubTitle.set('Test model');
        await detail().addSubtask();
        expect(created[0]).toEqual(expect.objectContaining({ level: 2, parentId: 'c1', title: 'Test model' }));
        expect(store.card('c1')?.childrenCount).toBe(3);
    });
});

import { Component, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { TaskDetail, TaskSearchRequest, TaskStatus, UpdateTaskRequest } from '../../../core/models/task.models';
import { AuthService } from '../../../core/services/auth.service';
import { MeetingService } from '../../../core/services/meeting.service';
import { TaskBoardStore } from '../../../core/services/task-board.store';
import { BOARD, makeTask, pageOf, TEST_ICONS } from '../../../core/services/task-board.testing';
import { TaskService } from '../../../core/services/task.service';
import { CardDetail } from './card-detail';

const LIST = makeTask({ id: 'l1', level: 1, parentId: 'w1', title: 'Backend' });
const CARD: TaskDetail = { ...makeTask({ id: 'c1', parentId: 'l1', title: 'Tích hợp API' }), shares: [], children: [] };

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
    let updates: UpdateTaskRequest[];

    beforeEach(async () => {
        updates = [];
        await TestBed.configureTestingModule({
            imports: [Host, NoopAnimationsModule],
            providers: [
                provideRouter([]),
                provideNzI18n(en_US),
                provideNzDateFnsAdapter(),
                provideNzIcons(TEST_ICONS),
                NzModalService,
                {
                    provide: TaskService,
                    useValue: {
                        get: (id: string) => of(id === 'w1' ? BOARD : CARD),
                        query: (q: TaskSearchRequest) => of(pageOf(q.level === 1 ? [LIST] : [CARD])),
                        updateStatus: (id: string, status: number) => of({ ...CARD, status }),
                        update: (_id: string, p: UpdateTaskRequest) => {
                            updates.push(p);
                            return of({ ...CARD, ...p });
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

    function detail(): Record<string, (...args: unknown[]) => Promise<void> | void> {
        return fixture.debugElement.children[0].componentInstance;
    }

    it('đổi trạng thái ở drawer cập nhật thẻ trên bảng', async () => {
        await detail()['onStatus'](TaskStatus.Completed);
        expect(store.card('c1')?.status).toBe(TaskStatus.Completed);
    });

    it('sửa ưu tiên gửi PUT đủ field, không đổi đầu việc cha', async () => {
        detail()['onPriority'](2);
        await fixture.whenStable();
        expect(updates[0]).toEqual(expect.objectContaining({ priority: 2, title: 'Tích hợp API' }));
        expect(updates[0].parentId).toBeUndefined();
    });

    it('hiện tên đầu việc chứa việc nhỏ', () => {
        expect(document.body.textContent).toContain('trong đầu việc “Backend”');
    });
});

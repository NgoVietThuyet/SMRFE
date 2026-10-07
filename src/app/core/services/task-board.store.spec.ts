import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import { TaskListItem, TaskPriority, TaskStatus } from '../models/task.models';
import { BOARD, makeTask } from './task-board.testing';
import { classifyBoardError, compareCards, TaskBoardStore } from './task-board.store';
import { TaskService } from './task.service';

describe('TaskBoardStore', () => {
    let store: TaskBoardStore;
    let cards: TaskListItem[];
    let statusResponse: () => Observable<TaskListItem>;
    let statusCalls: { id: string; status: number }[];

    beforeEach(() => {
        cards = [
            makeTask({ id: 'c1', status: TaskStatus.NotStarted }),
            makeTask({ id: 'c2', status: TaskStatus.InProgress, priority: TaskPriority.High }),
            makeTask({ id: 'c3', status: TaskStatus.Completed, canEdit: false }),
        ];
        statusCalls = [];
        statusResponse = () => of(makeTask({ id: 'c1', status: TaskStatus.InProgress }));

        TestBed.configureTestingModule({
            providers: [
                TaskBoardStore,
                {
                    provide: TaskService,
                    useValue: {
                        get: () => of(BOARD),
                        query: () => of({ items: cards, totalItems: cards.length, totalPages: 1, page: 1, pageSize: 100, summary: { total: 3, mine: 0, overdue: 0, today: 0 } }),
                        updateStatus: (id: string, status: number) => {
                            statusCalls.push({ id, status });
                            return statusResponse();
                        },
                        create: (p: { title: string; status: TaskStatus }) => of(makeTask({ id: 'new', title: p.title, status: p.status })),
                    },
                },
            ],
        });
        store = TestBed.inject(TaskBoardStore);
    });

    it('tải bảng và nhóm thẻ theo cột trạng thái', async () => {
        await store.load('w1');
        expect(store.board()?.title).toBe('Bảng A');
        const groups = store.cardsByStatus();
        expect(groups.get(TaskStatus.NotStarted)?.map((c) => c.id)).toEqual(['c1']);
        expect(groups.get(TaskStatus.InProgress)?.map((c) => c.id)).toEqual(['c2']);
        expect(groups.get(TaskStatus.Completed)?.map((c) => c.id)).toEqual(['c3']);
        expect(store.progress()).toEqual({ done: 1, total: 3, percent: 33 });
    });

    it('move cập nhật ngay (optimistic) và gọi đúng 1 PATCH /status', async () => {
        await store.load('w1');
        const pending = new Subject<TaskListItem>();
        statusResponse = () => pending;
        const done = store.move('c1', TaskStatus.InProgress);
        expect(store.card('c1')?.status).toBe(TaskStatus.InProgress);
        expect(store.isPending('c1')).toBe(true);
        pending.next(makeTask({ id: 'c1', status: TaskStatus.InProgress }));
        pending.complete();
        expect(await done).toBeNull();
        expect(statusCalls).toEqual([{ id: 'c1', status: TaskStatus.InProgress }]);
        expect(store.isPending('c1')).toBe(false);
    });

    it('lỗi API thì trả thẻ về cột cũ và trả thông báo', async () => {
        await store.load('w1');
        statusResponse = () => throwError(() => new Error('Máy chủ bận.'));
        const error = await store.move('c1', TaskStatus.Completed);
        expect(error).toBe('Máy chủ bận.');
        expect(store.card('c1')?.status).toBe(TaskStatus.NotStarted);
        expect(store.isPending('c1')).toBe(false);
    });

    it('không gọi API với thẻ không có quyền sửa', async () => {
        await store.load('w1');
        const error = await store.move('c3', TaskStatus.NotStarted);
        expect(error).toContain('không có quyền');
        expect(statusCalls.length).toBe(0);
        expect(store.card('c3')?.status).toBe(TaskStatus.Completed);
    });

    it('addCard thêm thẻ vào cột tương ứng', async () => {
        await store.load('w1');
        await store.addCard('Mới', TaskStatus.InProgress);
        expect(store.cardsByStatus().get(TaskStatus.InProgress)?.some((c) => c.id === 'new')).toBe(true);
        expect(store.totalCards()).toBe(4);
    });

    it('lọc theo người phụ trách', async () => {
        cards[0] = makeTask({ id: 'c1', assigneeUserName: 'an', assigneeFullName: 'An' });
        await store.load('w1');
        store.assigneeFilter.set('an');
        expect(store.visibleCards().map((c) => c.id)).toEqual(['c1']);
        store.assigneeFilter.set('none');
        expect(store.visibleCards().map((c) => c.id)).toEqual(['c2', 'c3']);
    });
});

describe('compareCards / classifyBoardError', () => {
    it('sắp ưu tiên cao trước, rồi hạn gần trước', () => {
        const list = [
            makeTask({ id: 'a', priority: TaskPriority.Low, dueDate: '2026-10-01' }),
            makeTask({ id: 'b', priority: TaskPriority.High, dueDate: null }),
            makeTask({ id: 'c', priority: TaskPriority.High, dueDate: '2026-10-09' }),
        ].sort(compareCards);
        expect(list.map((t) => t.id)).toEqual(['c', 'b', 'a']);
    });

    it('phân biệt 404 và lỗi chung', () => {
        expect(classifyBoardError(new Error('Không tìm thấy công việc.')).kind).toBe('notfound');
        expect(classifyBoardError(new Error('Bạn chỉ có quyền xem công việc này.')).kind).toBe('forbidden');
        expect(classifyBoardError(new Error('Lỗi khác')).kind).toBe('error');
    });
});

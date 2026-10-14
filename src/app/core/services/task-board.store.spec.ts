import { TestBed } from '@angular/core/testing';
import { Observable, of, Subject, throwError } from 'rxjs';
import { CreateTaskRequest, TaskListItem, TaskPriority, TaskSearchRequest, TaskStatus, UpdateTaskRequest } from '../models/task.models';
import { BOARD, makeTask, pageOf } from './task-board.testing';
import { classifyBoardError, compareCards, TaskBoardStore } from './task-board.store';
import { TaskService } from './task.service';

describe('TaskBoardStore', () => {
    let store: TaskBoardStore;
    let lists: TaskListItem[];
    let cards: TaskListItem[];
    let updateResponse: (id: string, p: UpdateTaskRequest) => Observable<TaskListItem>;
    let updateCalls: { id: string; payload: UpdateTaskRequest }[];
    let removed: string[];

    beforeEach(() => {
        lists = [
            makeTask({ id: 'l1', level: 1, parentId: 'w1', title: 'Backend', createDate: '2026-10-01T00:00:00' }),
            makeTask({ id: 'l2', level: 1, parentId: 'w1', title: 'Frontend', createDate: '2026-10-02T00:00:00' }),
        ];
        cards = [
            makeTask({ id: 'c1', parentId: 'l1' }),
            makeTask({ id: 'c2', parentId: 'l1', status: TaskStatus.Completed }),
            makeTask({ id: 'c3', parentId: 'l2', canEdit: false }),
        ];
        updateCalls = [];
        removed = [];
        updateResponse = (id, p) => of({ ...cards.find((c) => c.id === id)!, parentId: p.parentId ?? null });

        TestBed.configureTestingModule({
            providers: [
                TaskBoardStore,
                {
                    provide: TaskService,
                    useValue: {
                        get: () => of(BOARD),
                        query: (q: TaskSearchRequest) =>
                            of(pageOf(q.level === 1 ? lists : cards.filter((c) => c.parentId === q.parentId))),
                        update: (id: string, payload: UpdateTaskRequest) => {
                            updateCalls.push({ id, payload });
                            return updateResponse(id, payload);
                        },
                        updateStatus: (id: string, status: number) => of({ ...cards.find((c) => c.id === id)!, status }),
                        create: (p: CreateTaskRequest) =>
                            of(makeTask({ id: 'new' + p.level, title: p.title, level: p.level, parentId: p.parentId ?? null, createDate: '2026-10-09T00:00:00' })),
                        remove: (id: string) => {
                            removed.push(id);
                            return of(undefined);
                        },
                    },
                },
            ],
        });
        store = TestBed.inject(TaskBoardStore);
    });

    it('bảng mới không có cột mặc định', async () => {
        lists = [];
        await store.load('w1');
        expect(store.board()?.title).toBe('Bảng A');
        expect(store.sortedLists()).toEqual([]);
        expect(store.cards()).toEqual([]);
    });

    it('tải cột (đầu việc) và nhóm thẻ (việc nhỏ) theo cột', async () => {
        await store.load('w1');
        expect(store.sortedLists().map((l) => l.title)).toEqual(['Backend', 'Frontend']);
        const groups = store.cardsByList();
        expect(groups.get('l1')?.map((c) => c.id)).toEqual(['c1', 'c2']); // chưa xong trước
        expect(groups.get('l2')?.map((c) => c.id)).toEqual(['c3']);
        expect(store.progress()).toEqual({ done: 1, total: 3, percent: 33 });
    });

    it('addList thêm cột mới ở cuối', async () => {
        await store.load('w1');
        await store.addList('Kiểm thử');
        expect(store.sortedLists().map((l) => l.title)).toEqual(['Backend', 'Frontend', 'Kiểm thử']);
    });

    it('moveCard cập nhật ngay và gửi PUT với parentId mới', async () => {
        await store.load('w1');
        const pending = new Subject<TaskListItem>();
        updateResponse = () => pending;
        const done = store.moveCard('c1', 'l2');
        expect(store.card('c1')?.parentId).toBe('l2');
        expect(store.isPending('c1')).toBe(true);
        pending.next(makeTask({ id: 'c1', parentId: 'l2' }));
        pending.complete();
        expect(await done).toBeNull();
        expect(updateCalls.length).toBe(1);
        expect(updateCalls[0].payload.parentId).toBe('l2');
        expect(store.cardsByList().get('l2')?.some((c) => c.id === 'c1')).toBe(true);
    });

    it('lỗi API thì trả thẻ về cột cũ', async () => {
        await store.load('w1');
        updateResponse = () => throwError(() => new Error('Máy chủ bận.'));
        expect(await store.moveCard('c1', 'l2')).toBe('Máy chủ bận.');
        expect(store.card('c1')?.parentId).toBe('l1');
        expect(store.isPending('c1')).toBe(false);
    });

    it('không gọi API với thẻ không có quyền sửa', async () => {
        await store.load('w1');
        expect(await store.moveCard('c3', 'l1')).toContain('không có quyền');
        expect(updateCalls.length).toBe(0);
    });

    it('không cho xóa cột còn việc nhỏ', async () => {
        await store.load('w1');
        expect(await store.removeList('l1')).toContain('còn việc nhỏ');
        expect(removed).toEqual([]);
        lists.push(makeTask({ id: 'l3', level: 1, parentId: 'w1', title: 'Rỗng' }));
        await store.load('w1');
        expect(await store.removeList('l3')).toBeNull();
        expect(removed).toEqual(['l3']);
    });

    it('lọc thẻ theo người phụ trách', async () => {
        cards[0] = makeTask({ id: 'c1', parentId: 'l1', assigneeUserName: 'an', assigneeFullName: 'An' });
        await store.load('w1');
        store.assigneeFilter.set('an');
        expect(store.cardsByList().get('l1')?.map((c) => c.id)).toEqual(['c1']);
        expect(store.cardsByList().get('l2')).toEqual([]);
    });
});

describe('compareCards / classifyBoardError', () => {
    it('chưa xong trước, rồi ưu tiên cao, rồi hạn gần', () => {
        const list = [
            makeTask({ id: 'a', priority: TaskPriority.Low, dueDate: '2026-10-01' }),
            makeTask({ id: 'b', priority: TaskPriority.High, dueDate: null }),
            makeTask({ id: 'c', priority: TaskPriority.High, dueDate: '2026-10-09' }),
            makeTask({ id: 'd', priority: TaskPriority.High, status: TaskStatus.Completed }),
        ].sort(compareCards);
        expect(list.map((t) => t.id)).toEqual(['c', 'b', 'a', 'd']);
    });

    it('phân biệt 404, 403 và lỗi chung', () => {
        expect(classifyBoardError(new Error('Không tìm thấy công việc.')).kind).toBe('notfound');
        expect(classifyBoardError(new Error('Bạn chỉ có quyền xem công việc này.')).kind).toBe('forbidden');
        expect(classifyBoardError(new Error('Lỗi khác')).kind).toBe('error');
    });
});

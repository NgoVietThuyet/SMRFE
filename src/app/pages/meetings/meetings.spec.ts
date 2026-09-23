import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import {
    CalendarOutline,
    EyeOutline,
    MoreOutline,
    PlusOutline,
    SearchOutline,
} from '@ant-design/icons-angular/icons';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { provideHttpClient } from '@angular/common/http';
import { of } from 'rxjs';
import { MeetingStatus, MeetingListItemDto } from '../../core/models/dashboard.models';
import { MeetingService } from '../../core/services/meeting.service';
import { PagedMeetings } from '../../core/models/meeting.models';
import { Meetings } from './meetings';

const ITEMS: MeetingListItemDto[] = [
    {
        id: 'm1',
        name: 'Họp dự án A',
        description: '',
        expectedStartTime: new Date(Date.now() + 3600_000).toISOString(),
        expectedEndTime: null,
        status: MeetingStatus.Scheduled,
        visibility: 0,
        roomCode: 'R1',
        joinUrl: '/meet/m1',
        participantCount: 3,
        isHost: true,
        hostName: 'Nguyễn Văn A',
    },
    {
        id: 'm2',
        name: 'Họp phòng ban',
        description: '',
        expectedStartTime: new Date().toISOString(),
        expectedEndTime: null,
        status: MeetingStatus.Ongoing,
        visibility: 0,
        roomCode: 'R2',
        joinUrl: '/meet/m2',
        participantCount: 5,
        isHost: false,
        hostName: 'Trần Văn B',
    },
];

describe('Meetings', () => {
    let fixture: ComponentFixture<Meetings>;
    let component: Meetings;
    let lastQuery: Record<string, unknown>;

    beforeEach(async () => {
        lastQuery = {};

        await TestBed.configureTestingModule({
            imports: [Meetings, NoopAnimationsModule],
            providers: [
                provideRouter([]),
                provideNzI18n(en_US),
                provideHttpClient(),
                provideNzDateFnsAdapter(),
                provideNzIcons([CalendarOutline, EyeOutline, MoreOutline, PlusOutline, SearchOutline]),
                {
                    provide: MeetingService,
                    useValue: {
                        query: (dto: Record<string, unknown>) => {
                            lastQuery = dto;
                            const paged: PagedMeetings = {
                                items: ITEMS,
                                totalItems: 2,
                                totalPages: 1,
                                page: 1,
                                pageSize: 10,
                            };
                            return of(paged);
                        },
                        create: () => of('new-id'),
                        searchUsers: () => of([]),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(Meetings);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create and load first page', () => {
        expect(component).toBeTruthy();
        expect(lastQuery['page']).toBe(1);
        expect(lastQuery['tab']).toBe('all');
        expect(fixture.nativeElement.textContent).toContain('Họp dự án A');
        expect(fixture.nativeElement.textContent).toContain('Họp phòng ban');
    });

    it('should render status with visual priority for ongoing', () => {
        const text = fixture.nativeElement.textContent as string;
        expect(text).toContain('Sắp diễn ra');
        expect(text).toContain('Đang diễn ra');
        expect(text).toContain('Tham gia');
    });

    it('should query with status and reset page on filter change', () => {
        component.page.set(3);
        component.onStatusChange(MeetingStatus.Ongoing);

        expect(lastQuery['status']).toBe(MeetingStatus.Ongoing);
        expect(lastQuery['page']).toBe(1);
    });

    it('should debounce keyword search', async () => {
        component.onKeywordInput('sprint');
        expect(lastQuery['keyword']).not.toBe('sprint');

        await new Promise((resolve) => setTimeout(resolve, 500));

        expect(lastQuery['keyword']).toBe('sprint');
        expect(lastQuery['page']).toBe(1);
    });

    it('should map date presets to range', () => {
        component.onDatePresetChange('past');

        expect(lastQuery['startDate']).toBeNull();
        expect(lastQuery['endDate']).not.toBeNull();
    });

    it('should query next page on pagination', () => {
        component.onPageChange(2);

        expect(lastQuery['page']).toBe(2);
    });

    it('should open create modal and reload after created', () => {
        expect(component.showCreateModal()).toBe(false);
        component.openCreate();
        expect(component.showCreateModal()).toBe(true);

        lastQuery = {};
        component.onMeetingCreated();

        expect(component.showCreateModal()).toBe(false);
        expect(lastQuery['page']).toBe(1);
    });

    it('should show empty state when no items', () => {
        component.items.set([]);
        component.loading.set(false);
        fixture.detectChanges();

        expect(fixture.nativeElement.textContent).toContain('Không tìm thấy cuộc họp');
    });
});

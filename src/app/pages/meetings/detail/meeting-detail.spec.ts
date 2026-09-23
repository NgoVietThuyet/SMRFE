import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import {
    CalendarOutline,
    CloseCircleOutline,
    DeleteOutline,
    DownloadOutline,
    EditOutline,
    EyeOutline,
    FileOutline,
    FileTextOutline,
    MoreOutline,
    PlayCircleOutline,
    PlusOutline,
    SearchOutline,
} from '@ant-design/icons-angular/icons';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { MeetingStatus } from '../../../core/models/dashboard.models';
import { MeetingDetailDto } from '../../../core/models/meeting.models';
import { MeetingService } from '../../../core/services/meeting.service';
import { MeetingDetail } from './meeting-detail';

const DETAIL = {
    id: 'm1',
    name: 'Họp dự án A',
    description: 'Mô tả dự án',
    agenda: 'Nội dung 1',
    expectedStartTime: new Date(Date.now() + 3600_000).toISOString(),
    expectedEndTime: null,
    timeZone: 'Asia/Bangkok',
    status: MeetingStatus.Scheduled,
    visibility: 0,
    roomCode: 'R1',
    joinUrl: '/meet/m1',
    participantCount: 1,
    hostName: 'Nguyễn Văn A',
    isHost: true,
    canManage: true,
    cancellationReason: '',
    settings: {},
    participants: [
        {
            userName: 'admin',
            fullName: 'Nguyễn Văn A',
            email: 'a@company.vn',
            organizationId: '',
            titleCode: '',
            role: 1,
            isJoined: false,
        },
    ],
    activity: [],
    rowVersion: '',
} as unknown as MeetingDetailDto;

describe('MeetingDetail', () => {
    let fixture: ComponentFixture<MeetingDetail>;
    let component: MeetingDetail;
    let detail$: 'ok' | 'error404' | 'error500' = 'ok';
    let cancelCalls: string[];

    beforeEach(async () => {
        detail$ = 'ok';
        cancelCalls = [];

        await TestBed.configureTestingModule({
            imports: [MeetingDetail, NoopAnimationsModule],
            providers: [
                provideRouter([]),
                provideNzI18n(en_US),
                provideNzDateFnsAdapter(),
                provideNzIcons([
                    CalendarOutline,
                    CloseCircleOutline,
                    DeleteOutline,
                    DownloadOutline,
                    EditOutline,
                    EyeOutline,
                    FileOutline,
                    FileTextOutline,
                    MoreOutline,
                    PlayCircleOutline,
                    PlusOutline,
                    SearchOutline,
                ]),
                {
                    provide: ActivatedRoute,
                    useValue: { snapshot: { paramMap: new Map([['id', 'm1']]) } },
                },
                {
                    provide: MeetingService,
                    useValue: {
                        getDetail: () => {
                            if (detail$ === 'ok') return of(DETAIL);
                            if (detail$ === 'error404') {
                                return throwError(() => new HttpErrorResponse({ status: 404 }));
                            }
                            return throwError(() => new Error('Lỗi mạng.'));
                        },
                        update: () => of(DETAIL),
                        cancel: (_id: string, reason: string) => {
                            cancelCalls.push(reason);
                            return of(undefined);
                        },
                        getFiles: () => of([]),
                        downloadUrl: () => of('https://cdn/x'),
                        searchUsers: () => of([]),
                        addParticipants: () => of(DETAIL),
                        removeParticipant: () => of(undefined),
                    },
                },
                { provide: NzMessageService, useValue: { success: () => undefined, error: () => undefined } },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(MeetingDetail);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create with header and 5 tabs', () => {
        expect(component).toBeTruthy();
        const text = fixture.nativeElement.textContent as string;
        expect(text).toContain('Họp dự án A');
        expect(text).toContain('Sắp diễn ra');
        for (const tab of ['Thông tin chung', 'Tài liệu', 'Người tham gia', 'AI tóm tắt', 'Ghi hình']) {
            expect(text).toContain(tab);
        }
    });

    it('should show join button only when joinable', () => {
        expect(fixture.nativeElement.querySelector('#btn-join')).toBeNull();

        component.meeting.set({ ...DETAIL, status: MeetingStatus.Ongoing });
        fixture.detectChanges();
        expect(fixture.nativeElement.querySelector('#btn-join')).not.toBeNull();
    });

    it('should cancel meeting with reason and reload', async () => {
        expect(component.canCancel()).toBe(true);

        component.openCancel();
        component.cancelReason.set('Trùng lịch ban giám đốc');
        component.confirmCancel();
        await fixture.whenStable();
        fixture.detectChanges();

        expect(cancelCalls).toEqual(['Trùng lịch ban giám đốc']);
        expect(component.cancelOpen()).toBe(false);
    });

    it('should block cancel without reason', () => {
        component.openCancel();
        component.cancelReason.set('   ');
        component.confirmCancel();

        expect(cancelCalls.length).toBe(0);
        expect(component.cancelOpen()).toBe(true);
    });

    it('should switch tabs', () => {
        component.activeTab.set(2);
        fixture.detectChanges();

        expect(fixture.nativeElement.textContent).toContain('Nguyễn Văn A');
    });

    it('should show not found on 404', () => {
        detail$ = 'error404';
        component.load();
        fixture.detectChanges();

        expect(component.notFound()).toBe(true);
        expect(fixture.nativeElement.textContent).toContain('Không tìm thấy cuộc họp');
    });

    it('should show retry on generic error', () => {
        detail$ = 'error500';
        component.load();
        fixture.detectChanges();

        expect(component.loadError()).toBe('Lỗi mạng.');
        expect(fixture.nativeElement.textContent).toContain('Thử lại');
    });
});

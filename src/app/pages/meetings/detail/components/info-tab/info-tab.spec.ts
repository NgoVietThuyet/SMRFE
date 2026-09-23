import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { of, throwError } from 'rxjs';
import { MeetingStatus } from '../../../../../core/models/dashboard.models';
import { MeetingDetailDto } from '../../../../../core/models/meeting.models';
import { MeetingService } from '../../../../../core/services/meeting.service';
import { InfoTab } from './info-tab';

const MEETING = {
    id: 'm1',
    name: 'Họp dự án A',
    description: 'Mô tả',
    agenda: 'Nội dung',
    expectedStartTime: new Date(Date.now() + 3600_000).toISOString(),
    expectedEndTime: null,
    timeZone: 'Asia/Bangkok',
    status: MeetingStatus.Scheduled,
    visibility: 0,
    canManage: true,
    settings: { chatEnabled: true },
    rowVersion: 'v1',
} as unknown as MeetingDetailDto;

describe('InfoTab', () => {
    let fixture: ComponentFixture<InfoTab>;
    let component: InfoTab;
    let updateCalls: unknown[];

    beforeEach(async () => {
        updateCalls = [];

        await TestBed.configureTestingModule({
            imports: [InfoTab, NoopAnimationsModule],
            providers: [
                provideNzI18n(en_US),
                provideNzDateFnsAdapter(),
                {
                    provide: MeetingService,
                    useValue: {
                        update: (_id: string, payload: unknown) => {
                            updateCalls.push(payload);
                            return of({ ...MEETING, name: 'Đã sửa' });
                        },
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(InfoTab);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('meeting', MEETING);
        fixture.detectChanges();
    });

    it('should create and render view mode', () => {
        expect(component).toBeTruthy();
        expect(fixture.nativeElement.textContent).toContain('Họp dự án A');
        expect(fixture.nativeElement.textContent).toContain('Chỉnh sửa');
    });

    it('should save mapped payload and emit updated', () => {
        let emitted: MeetingDetailDto | undefined;
        component.updated.subscribe((d) => (emitted = d));

        component.startEdit();
        fixture.detectChanges();
        component.form.controls.name.setValue('Họp mới');
        component.save();

        expect(updateCalls.length).toBe(1);
        expect(emitted?.name).toBe('Đã sửa');
        expect(component.editing()).toBe(false);
    });

    it('should block save when name empty', () => {
        component.startEdit();
        component.form.controls.name.setValue('');
        component.save();

        expect(updateCalls.length).toBe(0);
    });

    it('should stay in edit mode when meeting ended', () => {
        fixture.componentRef.setInput('meeting', { ...MEETING, status: MeetingStatus.Ended });
        fixture.detectChanges();

        component.startEdit();

        expect(component.canEdit()).toBe(false);
        expect(component.editing()).toBe(false);
    });

    it('should hide edit when no permission', () => {
        fixture.componentRef.setInput('meeting', { ...MEETING, canManage: false });
        fixture.detectChanges();

        expect(component.canEdit()).toBe(false);
        expect(fixture.nativeElement.textContent).not.toContain('Chỉnh sửa');
    });
});

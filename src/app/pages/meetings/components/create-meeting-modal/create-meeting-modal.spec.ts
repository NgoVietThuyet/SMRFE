import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { Subject, of } from 'rxjs';
import { MeetingService } from '../../../../core/services/meeting.service';
import { CreateMeetingModal } from './create-meeting-modal';

describe('CreateMeetingModal', () => {
    let fixture: ComponentFixture<CreateMeetingModal>;
    let component: CreateMeetingModal;
    let create$: Subject<string>;

    beforeEach(async () => {
        create$ = new Subject<string>();

        await TestBed.configureTestingModule({
            imports: [CreateMeetingModal, NoopAnimationsModule],
            providers: [
                provideNzI18n(en_US),
                provideNzDateFnsAdapter(),
                {
                    provide: MeetingService,
                    useValue: {
                        create: () => create$.asObservable(),
                        searchUsers: () => of([]),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(CreateMeetingModal);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('open', true);
        fixture.detectChanges();
    });

    afterEach(() => {
        // nz-modal render overlay ra document.body — dọn để không rò sang test khác
        document.querySelectorAll('.ant-modal-root, .ant-modal-mask').forEach((el) => el.remove());
    });

    function fillValid(): void {
        const now = new Date();
        component.form.setValue({
            name: 'Họp Sprint 08',
            description: 'Triển khai sprint',
            agenda: 'Điểm lại tiến độ',
            expectedStartTime: new Date(now.getTime() + 3600_000),
            expectedEndTime: new Date(now.getTime() + 2 * 3600_000),
            visibility: 0,
            participantUserNames: ['user1'],
            settings: {
                lobbyEnabled: false,
                allowGuests: false,
                allowJoinBeforeHost: false,
                chatEnabled: true,
                screenShareEnabled: true,
                whiteboardEnabled: true,
                fileUploadEnabled: true,
                recordingEnabled: true,
                captionsEnabled: false,
                aiMinutesEnabled: true,
            },
        });
    }

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should block submit when required fields missing', () => {
        let emitted = false;
        component.created.subscribe(() => (emitted = true));

        component.submit(false);

        expect(emitted).toBe(false);
        expect(component.form.controls.name.hasError('required')).toBe(true);
        expect(component.form.controls.expectedStartTime.hasError('required')).toBe(true);
    });

    it('should flag end time before start time', () => {
        const now = new Date();
        component.form.controls.expectedStartTime.setValue(new Date(now.getTime() + 2 * 3600_000));
        component.form.controls.expectedEndTime.setValue(new Date(now.getTime() + 3600_000));

        expect(component.form.hasError('endBeforeStart')).toBe(true);
    });

    it('should submit mapped payload and emit created id', () => {
        fillValid();
        let createdId = '';
        component.created.subscribe((id) => (createdId = id));

        component.submit(false);
        expect(component.saving()).toBe('create');

        create$.next('abc123');

        expect(createdId).toBe('abc123');
        expect(component.saving()).toBeNull();
    });

    it('should submit as draft when saving draft', () => {
        fillValid();
        component.submit(true);
        expect(component.saving()).toBe('draft');
        create$.next('draft1');
        expect(component.saving()).toBeNull();
    });

    it('should surface server error message', async () => {
        fillValid();
        fixture.detectChanges();

        component.submit(false);
        create$.error(new Error('Không thể lên lịch cuộc họp trong quá khứ.'));
        // Overlay của nz-modal render bất đồng bộ ra document.body
        await new Promise((resolve) => setTimeout(resolve, 50));
        fixture.detectChanges();

        expect(component.saving()).toBeNull();
        expect(component.submitError()).toBe('Không thể lên lịch cuộc họp trong quá khứ.');
        expect(document.body.querySelector('.cmm-error')?.textContent).toContain(
            'Không thể lên lịch cuộc họp trong quá khứ.'
        );
    });

    it('should not close while saving', () => {
        fillValid();
        let closed = false;
        component.closed.subscribe(() => (closed = true));

        component.submit(false);
        component.close();

        expect(closed).toBe(false);
    });
});

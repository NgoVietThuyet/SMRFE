import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { DeleteOutline, MoreOutline, PlusOutline, SearchOutline } from '@ant-design/icons-angular/icons';
import { of } from 'rxjs';
import { MeetingDetailDto } from '../../../../../core/models/meeting.models';
import { MeetingService } from '../../../../../core/services/meeting.service';
import { ParticipantsTab } from './participants-tab';

const MEETING = {
    id: 'm1',
    canManage: true,
    participants: [
        { userName: 'admin', fullName: 'Nguyễn Văn A', email: 'a@x.vn', role: 1, isJoined: true },
        { userName: 'user1', fullName: 'Trần Văn B', email: 'b@x.vn', role: 4, isJoined: false },
    ],
} as unknown as MeetingDetailDto;

describe('ParticipantsTab', () => {
    let fixture: ComponentFixture<ParticipantsTab>;
    let component: ParticipantsTab;
    let addedNames: string[][];

    beforeEach(async () => {
        addedNames = [];

        await TestBed.configureTestingModule({
            imports: [ParticipantsTab, NoopAnimationsModule, NzModalModule],
            providers: [
                provideNzI18n(en_US),
                provideNzIcons([DeleteOutline, MoreOutline, PlusOutline, SearchOutline]),
                {
                    provide: MeetingService,
                    useValue: {
                        searchUsers: () => of([]),
                        addParticipants: (_id: string, names: string[]) => {
                            addedNames.push(names);
                            return of(MEETING);
                        },
                        removeParticipant: () => of(undefined),
                    },
                },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(ParticipantsTab);
        component = fixture.componentInstance;
        fixture.componentRef.setInput('meeting', MEETING);
        fixture.detectChanges();
    });

    it('should create and render members', () => {
        expect(component).toBeTruthy();
        const text = fixture.nativeElement.textContent as string;
        expect(text).toContain('Nguyễn Văn A');
        expect(text).toContain('Đã tham gia');
        expect(text).toContain('Chưa vào');
    });

    it('should filter by keyword', () => {
        component.keyword.set('trần');
        fixture.detectChanges();

        expect(component.filtered().length).toBe(1);
        expect(fixture.nativeElement.textContent).not.toContain('Nguyễn Văn A');
    });

    it('should add selected users', () => {
        let changed: MeetingDetailDto | undefined;
        component.changed.subscribe((d) => (changed = d));

        component.openAdd();
        component.selected.set(['user2']);
        component.confirmAdd();

        expect(addedNames).toEqual([['user2']]);
        expect(changed).toBeTruthy();
        expect(component.adding()).toBe(false);
    });

    it('should not add when nothing selected', () => {
        component.openAdd();
        component.selected.set([]);
        component.confirmAdd();

        expect(addedNames.length).toBe(0);
    });
});

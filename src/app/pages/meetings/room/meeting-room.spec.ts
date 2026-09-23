import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import {
    AppstoreOutline,
    ArrowLeftOutline,
    AudioMutedOutline,
    AudioOutline,
    ClockCircleOutline,
    CloseOutline,
    CopyOutline,
    CrownOutline,
    DesktopOutline,
    FlagOutline,
    LockOutline,
    MessageOutline,
    PhoneOutline,
    SearchOutline,
    SendOutline,
    SettingOutline,
    TeamOutline,
    VideoCameraOutline,
} from '@ant-design/icons-angular/icons';
import { of, Subject, throwError } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { JitsiApi, JitsiService } from '../../../core/services/jitsi.service';
import { MeetingHubService } from '../../../core/services/meeting-hub.service';
import { MeetingService } from '../../../core/services/meeting.service';
import { ChatMessage } from '../../../core/models/meeting.models';
import { MeetingRoom } from './meeting-room';

function fakeApi(): JitsiApi & { commands: string[]; handlers: Record<string, (p?: never) => void> } {
    const handlers: Record<string, (p?: never) => void> = {};
    return {
        commands: [],
        handlers,
        executeCommand: function (command: string) {
            this.commands.push(command);
        },
        addEventListener: (event: string, handler: (p?: never) => void) => {
            handlers[event] = handler;
        },
        removeEventListener: () => undefined,
        getNumberOfParticipants: () => 3,
        isAudioMuted: () => Promise.resolve(true),
        isVideoMuted: () => Promise.resolve(true),
        dispose: () => undefined,
    };
}

describe('MeetingRoom', () => {
    let fixture: ComponentFixture<MeetingRoom>;
    let component: MeetingRoom;
    let api: ReturnType<typeof fakeApi>;
    let hubMessages: Subject<ChatMessage>;
    let navigatedTo: unknown[][];
    let joinInfo$: 'ok' | 'error' = 'ok';
    let broadcasted: ChatMessage[];

    beforeEach(async () => {
        api = fakeApi();
        hubMessages = new Subject<ChatMessage>();
        navigatedTo = [];
        joinInfo$ = 'ok';
        broadcasted = [];

        await TestBed.configureTestingModule({
            imports: [MeetingRoom, NoopAnimationsModule],
            providers: [
                provideRouter([]),
                provideNzI18n(en_US),
                provideNzIcons([
                    AppstoreOutline,
                    ArrowLeftOutline,
                    AudioMutedOutline,
                    AudioOutline,
                    ClockCircleOutline,
                    CloseOutline,
                    CopyOutline,
                    CrownOutline,
                    DesktopOutline,
                    FlagOutline,
                    LockOutline,
                    MessageOutline,
                    PhoneOutline,
                    SearchOutline,
                    SendOutline,
                    SettingOutline,
                    TeamOutline,
                    VideoCameraOutline,
                ]),
                { provide: NzMessageService, useValue: { success: () => undefined, error: () => undefined } },
                {
                    provide: ActivatedRoute,
                    useValue: { snapshot: { paramMap: new Map([['id', 'm1']]) } },
                },
                {
                    provide: MeetingService,
                    useValue: {
                        getJoinInfo: () =>
                            joinInfo$ === 'ok'
                                ? of({
                                      meetingId: 'm1',
                                      roomName: 'smr_r1',
                                      domain: 'meet.d2s.vn',
                                      displayName: 'Nguyễn Văn A',
                                      isModerator: true,
                                      startWithAudioMuted: false,
                                      startWithVideoMuted: true,
                                  })
                                : throwError(() => new Error('Cuộc họp đã kết thúc.')),
                        getDetail: () =>
                            of({
                                id: 'm1',
                                name: 'Họp dự án A',
                                status: 2,
                                participants: [],
                                activity: [],
                            }),
                        join: () => of(undefined),
                        leave: () => of(undefined),
                        getMessages: () => of([]),
                        sendMessage: (_id: string, text: string) =>
                            of({
                                id: 'msg1',
                                senderUserId: 'admin',
                                senderName: 'Nguyễn Văn A',
                                messageText: text,
                                createdAt: new Date().toISOString(),
                            }),
                    },
                },
                { provide: JitsiService, useValue: { createRoom: () => Promise.resolve(api) } },
                {
                    provide: MeetingHubService,
                    useValue: {
                        joinRoom: () => Promise.resolve(),
                        leaveRoom: () => Promise.resolve(),
                        broadcastMessage: (_id: string, msg: ChatMessage) => {
                            broadcasted.push(msg);
                            return Promise.resolve();
                        },
                        messageReceived: hubMessages.asObservable(),
                        participantChanged: new Subject<void>().asObservable(),
                    },
                },
            ],
        }).compileComponents();

        const router = TestBed.inject(Router);
        router.navigate = ((...args: unknown[]) => {
            navigatedTo.push(args);
            return Promise.resolve(true);
        }) as typeof router.navigate;

        fixture = TestBed.createComponent(MeetingRoom);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    async function settled(): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, 20));
        fixture.detectChanges();
    }

    it('should create and join room with BE room name', async () => {
        await settled();
        expect(component).toBeTruthy();
        expect(component.meetingId()).toBe('m1');
        expect(component.meeting()?.name).toBe('Họp dự án A');

        api.handlers['videoConferenceJoined']!();
        await settled();

        expect(component.phase()).toBe('live');
        expect(component.joined()).toBe(true);
        expect(fixture.nativeElement.textContent).toContain('Họp dự án A');
    });

    it('should toggle media via Jitsi commands', async () => {
        await settled();
        api.handlers['videoConferenceJoined']!();

        component.toggleAudio();
        component.toggleVideo();
        component.toggleShare();
        component.toggleHand();
        component.toggleTileView();

        expect(api.commands).toEqual([
            'toggleAudio',
            'toggleVideo',
            'toggleShareScreen',
            'toggleRaiseHand',
            'toggleTileView',
        ]);
        expect(component.handRaised()).toBe(true);
    });

    function fire(event: string, payload?: Record<string, unknown>): void {
        (api.handlers[event] as unknown as (p?: Record<string, unknown>) => void)?.(payload);
    }

    it('should show REC badge and speaker bar from Jitsi events', async () => {
        await settled();
        api.handlers['videoConferenceJoined']!();
        (api as unknown as { getParticipantsInfo?: unknown }).getParticipantsInfo = () => [
            { participantId: 'p1', displayName: 'Trần Văn B' },
        ];
        fire('recordingStatusChanged', { on: true });
        fire('dominantSpeakerChanged', { id: 'p1' });
        fixture.detectChanges();

        expect(component.recording()).toBe(true);
        expect(component.speakerName()).toBe('Trần Văn B');
        expect(fixture.nativeElement.textContent).toContain('REC');
        expect(fixture.nativeElement.textContent).toContain('Trần Văn B');
    });

    it('should hide speaker bar when captions off', async () => {
        await settled();
        api.handlers['videoConferenceJoined']!();
        component.speakerName.set('Trần Văn B');
        component.toggleCaptions();
        fixture.detectChanges();

        expect(component.captionsOn()).toBe(false);
        expect(fixture.nativeElement.querySelector('.room__speaker')).toBeNull();
    });

    it('should filter participants by search text', async () => {
        await settled();
        component.meeting.set({
            ...(component.meeting() as object),
            participants: [
                { userName: 'admin', fullName: 'Nguyễn Văn A', email: 'a@x.vn', role: 1 },
                { userName: 'user1', fullName: 'Trần Văn B', email: 'b@x.vn', role: 4 },
            ],
        } as never);
        component.panel.set('participants');
        component.participantFilter.set('trần');
        fixture.detectChanges();

        expect(component.filteredParticipants().length).toBe(1);
        expect(fixture.nativeElement.textContent).toContain('Trần Văn B');
        expect(fixture.nativeElement.textContent).not.toContain('Nguyễn Văn A');
    });

    it('should copy invite link with feedback', async () => {
        await settled();
        const message = TestBed.inject(NzMessageService);
        let successMsg = '';
        message.success = ((msg: string) => {
            successMsg = msg;
            return undefined;
        }) as unknown as typeof message.success;
        Object.defineProperty(navigator, 'clipboard', {
            value: { writeText: () => Promise.resolve() },
            configurable: true,
        });

        component.copyInvite();
        await settled();

        expect(successMsg).toBe('Đã sao chép link mời.');
    });

    it('should send chat and broadcast over hub', async () => {
        await settled();
        component.panel.set('chat');
        component.chatInput.set('Xin chào');
        component.sendChat();
        await settled();

        expect(component.chat().length).toBe(1);
        expect(component.chat()[0].messageText).toBe('Xin chào');
        expect(broadcasted.length).toBe(1);
        expect(component.chatInput()).toBe('');
    });

    it('should count unread when chat panel closed', async () => {
        await settled();
        hubMessages.next({
            id: 'msg9',
            senderUserId: 'user1',
            senderName: 'Trần Văn B',
            messageText: 'Nghe rõ không?',
            createdAt: new Date().toISOString(),
        });
        fixture.detectChanges();

        expect(component.chat().length).toBe(1);
        expect(component.unread()).toBe(1);
    });

    it('should show error when join-info fails', async () => {
        joinInfo$ = 'error';
        await component.enter();
        fixture.detectChanges();

        expect(component.phase()).toBe('error');
        expect(fixture.nativeElement.textContent).toContain('Cuộc họp đã kết thúc.');
    });

    it('should leave room and return to detail', async () => {
        await settled();
        await component.leave();

        expect(navigatedTo).toEqual([[['/meetings', 'm1']]]);
    });
});

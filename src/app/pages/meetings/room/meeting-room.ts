import {
    Component,
    DestroyRef,
    ElementRef,
    HostListener,
    OnDestroy,
    OnInit,
    computed,
    inject,
    signal,
    viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { forkJoin } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AuthService } from '../../../core/services/auth.service';
import { JitsiApi, JitsiService } from '../../../core/services/jitsi.service';
import { MeetingHubService } from '../../../core/services/meeting-hub.service';
import { MeetingService } from '../../../core/services/meeting.service';
import { SpeechRecognitionService } from '../../../core/services/speech-recognition.service';
import {
    ChatMessage,
    MeetingCaptionDto,
    MeetingDetailDto,
    MeetingJoinInfo,
    MeetingParticipantRole,
} from '../../../core/models/meeting.models';
import { RoomDocsPanel } from './components/room-docs-panel/room-docs-panel';
import { RoomTasksPanel } from './components/room-tasks-panel/room-tasks-panel';
import { WhiteboardCanvas } from './components/whiteboard/whiteboard';
import { ROOM_I18N, RoomKey, RoomLang } from './room-i18n';
import { Avatar } from '../../../shared/ui/avatar/avatar';
import { PrejoinDevices, PrejoinPreview } from './prejoin-preview/prejoin-preview';

type Phase = 'loading' | 'prejoin' | 'connecting' | 'live' | 'ended' | 'error';
type SidePanel = 'participants' | 'chat' | 'docs' | 'tasks' | 'transcript' | 'ai' | null;


// =====================================================
// MeetingRoom — phòng họp chính thức realtime (redesign).
// - PreJoin: kiểm tra trạng thái trước khi join Jitsi.
// - Live: Jitsi iframe + SMR chrome + SignalR realtime.
// - Realtime: Presence/Files/Status sync qua Hub.
// =====================================================
@Component({
    selector: 'app-meeting-room',
    templateUrl: './meeting-room.html',
    styleUrl: './meeting-room.scss',
    imports: [
        PrejoinPreview,
        Avatar,
        CommonModule,
        FormsModule,
        NzButtonModule,
        NzDropdownModule,
        NzEmptyModule,
        NzIconModule,
        NzInputModule,
        NzMenuModule,
        NzModalModule,
        NzSpinModule,
        NzTooltipModule,
        RoomDocsPanel,
        RoomTasksPanel,
        WhiteboardCanvas,
    ],
})
export class MeetingRoom implements OnInit, OnDestroy {
    private readonly route = inject(ActivatedRoute);
    private readonly router = inject(Router);
    private readonly meetingService = inject(MeetingService);
    private readonly jitsi = inject(JitsiService);
    private readonly hub = inject(MeetingHubService);
    private readonly message = inject(NzMessageService);
    private readonly destroyRef = inject(DestroyRef);
    private readonly speechService = inject(SpeechRecognitionService);
    private readonly authService = inject(AuthService);

    private readonly mount = viewChild.required<ElementRef<HTMLElement>>('jitsiMount');
    private readonly chatScroll = viewChild<ElementRef<HTMLElement>>('chatScroll');

    phase = signal<Phase>('loading');
    errorMessage = signal<string>('');
    meeting = signal<MeetingDetailDto | null>(null);
    meetingId = signal<string>('');
    joinInfo = signal<MeetingJoinInfo | null>(null);

    private api: JitsiApi | null = null;
    private joinTimeout: ReturnType<typeof setTimeout> | null = null;
    joined = signal<boolean>(false);
    audioMuted = signal<boolean>(true);
    videoMuted = signal<boolean>(true);
    sharing = signal<boolean>(false);
    handRaised = signal<boolean>(false);
    recording = signal<boolean>(false);
    speakerName = signal<string | null>(null);
    captionsOn = signal<boolean>(true);
    captionLang = signal<'vi-VN' | 'en-US'>('vi-VN');
    activeCaption = signal<MeetingCaptionDto | null>(null);
    private captionTimer: ReturnType<typeof setTimeout> | null = null;
    transcripts = signal<MeetingCaptionDto[]>([]);
    transcriptSearch = signal<string>('');
    filteredTranscripts = computed(() => {
        const q = this.transcriptSearch().trim().toLowerCase();
        const list = this.transcripts();
        if (!q) return list;
        return list.filter(
            (item) =>
                item.text.toLowerCase().includes(q) ||
                item.speakerName.toLowerCase().includes(q)
        );
    });

    liveCount = signal<number>(1);
    elapsed = signal<number>(0);
    isStarting = signal<boolean>(false);
    private timer: ReturnType<typeof setInterval> | null = null;
    connectionState = signal<'connected' | 'reconnecting' | 'disconnected'>('connected');

    participantFilter = signal<string>('');
    filteredParticipants = computed(() => {
        const q = this.participantFilter().trim().toLowerCase();
        const list = this.meeting()?.participants ?? [];
        if (!q) return list;
        return list.filter(
            (p) =>
                p.fullName.toLowerCase().includes(q) ||
                p.userName.toLowerCase().includes(q) ||
                p.email.toLowerCase().includes(q)
        );
    });

    /** Người đã thực sự vào phòng / đã mời chưa vào — một nguồn đếm duy nhất (F-10). */
    joinedParticipants = computed(() => (this.meeting()?.participants ?? []).filter((p) => p.isJoined));
    participantGroups = computed(() => {
        const list = this.filteredParticipants();
        return [
            { key: 'inRoom' as const, items: list.filter((p) => p.isJoined) },
            { key: 'notJoined' as const, items: list.filter((p) => !p.isJoined) },
        ].filter((g) => g.items.length > 0);
    });
    /** Thiết bị chọn ở phòng chờ, chuyển cho Jitsi khi vào phòng. */
    preferredDevices = signal<PrejoinDevices | null>(null);

    panel = signal<SidePanel>(null);
    chat = signal<ChatMessage[]>([]);
    chatInput = signal<string>('');
    sending = signal<boolean>(false);
    unread = signal<number>(0);
    private chatLoaded = false;
    private leaving = false;

    lang = signal<RoomLang>('vi');
    whiteboardOpen = signal<boolean>(false);
    endOpen = signal<boolean>(false);
    ending = signal<boolean>(false);

    // Computed for prejoin/status
    canStart = computed(() => {
        const m = this.meeting();
        return !!m?.canManage && (m.status === 1 || m.status === 0); // Scheduled or Draft
    });
    isWaiting = computed(() => {
        const m = this.meeting();
        return !!m && m.status !== 2 && !this.canStart(); // not Ongoing and not host
    });
    isOngoing = computed(() => this.meeting()?.status === 2);
    isEnded = computed(() => {
        const s = this.meeting()?.status;
        return s === 3 || s === 4 || s === 5;
    });

    t(key: RoomKey): string {
        return ROOM_I18N[this.lang()][key];
    }

    constructor() {
        this.hub.connectionState.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((state) => {
            this.connectionState.set(state);
        });
        this.hub.messageReceived.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((msg) => {
            this.appendMessage(msg);
            if (this.panel() !== 'chat') this.unread.update((n) => n + 1);
            else queueMicrotask(() => this.scrollChatToBottom());
        });
        this.hub.participantChanged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
            this.refreshCount();
        });
        this.hub.presenceChanged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
            this.refreshPresence();
        });
        this.hub.meetingStatusChanged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((e) => {
            if (e.meetingId !== this.meetingId()) return;
            if (e.action === 'started') {
                this.message.info(this.lang() === 'vi' ? 'Cuộc họp đã bắt đầu.' : 'Meeting started.');
                this.reloadDetail();
                if (this.phase() === 'prejoin') void this.proceedToLive();
            } else if (e.action === 'ended') {
                this.message.warning(this.lang() === 'vi' ? 'Cuộc họp đã kết thúc.' : 'Meeting ended.');
                this.meeting.update((m) => (m ? { ...m, status: 3 } : m));
                this.stopTimer();
                if (this.phase() === 'live') {
                    this.phase.set('ended');
                    setTimeout(() => void this.leave(), 1800);
                } else {
                    this.phase.set('ended');
                    this.errorMessage.set(this.lang() === 'vi' ? 'Cuộc họp đã kết thúc.' : 'Meeting has ended.');
                }
            }
        });
        this.hub.filesChanged.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((e) => {
            if (e.meetingId === this.meetingId() && this.panel() === 'docs') {
                // RoomDocsPanel will reload via its own subscription; trigger via presence refresh count
                this.refreshCount();
            }
        });
        this.hub.captionReceived.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((caption) => {
            if (this.captionsOn()) {
                this.displayCaption(caption);
            }
            if (caption.isFinal) {
                this.transcripts.update((list) => [...list, caption]);
            }
        });
        this.speechService.captionResult.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((res) => {
            const user = this.authService.currentUser();
            const speakerName = user?.fullName || this.joinInfo()?.displayName || 'Tôi';
            const speakerUserName = user?.userName || '';
            const caption: MeetingCaptionDto = {
                meetingId: this.meetingId(),
                speakerUserName,
                speakerName,
                text: res.text,
                language: res.language,
                isFinal: res.isFinal,
                timestamp: new Date().toISOString(),
            };
            if (this.captionsOn()) {
                this.displayCaption(caption);
            }
            if (caption.isFinal) {
                this.transcripts.update((list) => [...list, caption]);
            }
            void this.hub.broadcastCaption(this.meetingId(), caption);
        });
    }

    @HostListener('window:keydown', ['$event'])
    onKeyDown(event: KeyboardEvent): void {
        if (this.phase() !== 'live') return;
        const target = event.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
        switch (event.key.toLowerCase()) {
            case 'm':
                event.preventDefault();
                this.toggleAudio();
                break;
            case 'v':
                event.preventDefault();
                this.toggleVideo();
                break;
            case 'd':
                event.preventDefault();
                this.toggleShare();
                break;
            case 'h':
                event.preventDefault();
                this.toggleHand();
                break;
            case 'c':
                event.preventDefault();
                this.togglePanel('chat');
                break;
            case 'p':
                event.preventDefault();
                this.togglePanel('participants');
                break;
            case 'escape':
                if (this.whiteboardOpen()) this.whiteboardOpen.set(false);
                else if (this.panel()) this.panel.set(null);
                break;
        }
    }

    ngOnInit(): void {
        void this.enter();
    }

    ngOnDestroy(): void {
        this.speechService.stopListening();
        if (this.captionTimer) clearTimeout(this.captionTimer);
        this.stopTimer();
        this.clearJoinTimeout();
        this.api?.dispose();
        this.api = null;
    }

    async enter(): Promise<void> {
        const id = this.route.snapshot.paramMap.get('id');
        if (!id) {
            this.fail('Thiếu mã cuộc họp.');
            return;
        }
        this.meetingId.set(id);
        this.phase.set('loading');
        this.errorMessage.set('');
        try {
            const { info, detail } = await new Promise<{
                info: MeetingJoinInfo;
                detail: MeetingDetailDto;
            }>((resolve, reject) => {
                forkJoin({ info: this.meetingService.getJoinInfo(id), detail: this.meetingService.getDetail(id) })
                    .pipe(takeUntilDestroyed(this.destroyRef))
                    .subscribe({ next: resolve, error: reject });
            });
            // join-info may fail for ended — fallback to detail only
            this.meeting.set(detail);
            this.joinInfo.set(info);
            this.audioMuted.set(info.startWithAudioMuted);
            this.videoMuted.set(info.startWithVideoMuted);

            // Decide phase
            if (detail.status === 3 || detail.status === 4 || detail.status === 5) {
                this.fail(detail.status === 4 ? 'Cuộc họp đã bị hủy.' : 'Cuộc họp đã kết thúc.');
                return;
            }
            if (detail.status !== 2) {
                // Not ongoing -> show prejoin
                this.phase.set('prejoin');
                // Join hub early to get statusChanged realtime even in prejoin
                try {
                    await this.hub.joinRoom(id);
                } catch {
                    // hub join fail not critical in prejoin
                }
                return;
            }
            await this.proceedToLive();
        } catch (err) {
            // Try fallback: if joinInfo fails but detail succeeds, show prejoin
            try {
                const detail = await new Promise<MeetingDetailDto>((resolve, reject) => {
                    this.meetingService
                        .getDetail(id)
                        .pipe(takeUntilDestroyed(this.destroyRef))
                        .subscribe({ next: resolve, error: reject });
                });
                this.meeting.set(detail);
                if (detail.status === 3 || detail.status === 4 || detail.status === 5) {
                    this.fail('Cuộc họp đã kết thúc hoặc bị hủy.');
                    return;
                }
                this.phase.set('prejoin');
                try {
                    await this.hub.joinRoom(id);
                } catch {}
                return;
            } catch {}
            this.fail(err instanceof Error ? err.message : 'Không thể vào phòng họp.');
        }
    }

    async proceedToLive(): Promise<void> {
        const id = this.meetingId();
        const info = this.joinInfo();
        const detail = this.meeting();
        if (!id || !detail) return;
        this.phase.set('connecting');
        // If joinInfo missing (fallback), fetch again
        let jInfo = info;
        if (!jInfo) {
            try {
                jInfo = await new Promise<MeetingJoinInfo>((resolve, reject) => {
                    this.meetingService
                        .getJoinInfo(id)
                        .pipe(takeUntilDestroyed(this.destroyRef))
                        .subscribe({ next: resolve, error: reject });
                });
                this.joinInfo.set(jInfo);
            } catch {
                this.fail('Không lấy được thông tin phòng họp.');
                return;
            }
        }
        try {
            await new Promise<void>((resolve, reject) => {
                this.meetingService
                    .join(id)
                    .pipe(takeUntilDestroyed(this.destroyRef))
                    .subscribe({ next: () => resolve(), error: reject });
            });
        } catch (e) {
            // If already Ongoing, join may fail only if not member — surface error
            if (detail.status !== 2) {
                // not critical for prejoin->live race
            } else if (e instanceof Error && e.message.includes('chưa bắt đầu')) {
                this.phase.set('prejoin');
                return;
            } else {
                // continue even if join fails — hub/media may still work
            }
        }
        try {
            await this.hub.joinRoom(id);
        } catch {
            // hub fail not fatal
        }

        // Ensure previous api disposed
        try {
            this.api?.dispose();
        } catch {}
        this.api = null;

        try {
            const api = await this.jitsi.createRoom({
                domain: jInfo.domain || (jInfo as any).jitsiDomain || 'meet.d2s.vn',
                externalApiUrl: jInfo.externalApiUrl,
                roomName: jInfo.roomName || (jInfo as any).roomCode || id,
                displayName: jInfo.displayName || 'Người tham gia',
                subject: detail.name,
                // Chính sách BE bắt tắt → luôn tắt; nếu không theo lựa chọn ở phòng chờ
                startWithAudioMuted: !!jInfo.startWithAudioMuted || this.audioMuted(),
                startWithVideoMuted: !!jInfo.startWithVideoMuted || this.videoMuted(),
                parentNode: this.mount().nativeElement,
                devices: this.preferredDevices() ?? undefined,
            });
            this.api = api;
            api.addEventListener('videoConferenceJoined', () => void this.onJoined());
            api.addEventListener('participantJoined', () => this.refreshCount());
            api.addEventListener('participantLeft', () => this.refreshCount());
            api.addEventListener('audioMuteStatusChanged', (p) => {
                this.audioMuted.set((p?.['muted'] as boolean) ?? true);
                this.syncSpeechRecognition();
            });
            api.addEventListener('videoMuteStatusChanged', (p) =>
                this.videoMuted.set((p?.['muted'] as boolean) ?? true)
            );
            api.addEventListener('screenSharingStatusChanged', (p) =>
                this.sharing.set((p?.['on'] as boolean) ?? false)
            );
            api.addEventListener('dominantSpeakerChanged', (p) =>
                this.onDominantSpeaker(p?.['id'] as string | undefined)
            );
            api.addEventListener('recordingStatusChanged', (p) =>
                this.recording.set((p?.['on'] as boolean) ?? false)
            );
            api.addEventListener('connectionStatusChanged', (p) => {
                const status = String(p?.['status'] ?? '').toLowerCase();
                if (status.includes('reconnect')) this.connectionState.set('reconnecting');
                else if (status.includes('disconnect') || status.includes('failed')) this.connectionState.set('disconnected');
                else if (status.includes('connect')) this.connectionState.set('connected');
            });
            api.addEventListener('raiseHandUpdated', (p) => {
                if (typeof p?.['handRaised'] === 'boolean') {
                    this.handRaised.set(p['handRaised'] as boolean);
                }
            });
            api.addEventListener('readyToClose', () => void this.leave());
            this.clearJoinTimeout();
            this.joinTimeout = setTimeout(() => {
                if (!this.joined()) {
                    this.fail('Kết nối phòng họp quá thời gian. Vui lòng thử lại.');
                    try { this.api?.dispose(); } catch {}
                    this.api = null;
                }
            }, 30000);
        } catch (err) {
            this.fail(err instanceof Error ? err.message : 'Không thể kết nối Jitsi.');
        }
    }

    async startMeeting(): Promise<void> {
        const id = this.meetingId();
        if (!id || this.isStarting()) return;
        this.isStarting.set(true);
        this.meetingService
            .start(id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.isStarting.set(false);
                    this.message.success(this.t('startOk') ?? 'Đã bắt đầu cuộc họp.');
                    this.meeting.update((m) => (m ? { ...m, status: 2 } : m));
                    void this.proceedToLive();
                },
                error: (err: Error) => {
                    this.isStarting.set(false);
                    this.message.error(err.message || 'Không thể bắt đầu cuộc họp.');
                },
            });
    }

    private async onJoined(): Promise<void> {
        this.clearJoinTimeout();
        this.joined.set(true);
        this.phase.set('live');
        try {
            this.audioMuted.set(await this.api!.isAudioMuted());
            this.videoMuted.set(await this.api!.isVideoMuted());
        } catch {
            // keep join-info state
        }
        this.refreshCount();
        this.startTimer();
        this.loadTranscripts();
        this.syncSpeechRecognition();
    }

    private refreshCount(): void {
        try {
            const n = this.api?.getNumberOfParticipants() ?? 0;
            if (n > 0) this.liveCount.set(n);
        } catch {
            // ignore
        }
    }

    private refreshPresence(): void {
        const id = this.meetingId();
        if (!id) return;
        this.meetingService
            .getDetail(id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (detail) => this.meeting.set(detail),
                error: () => {},
            });
        this.refreshCount();
    }

    private reloadDetail(): void {
        const id = this.meetingId();
        if (!id) return;
        this.meetingService
            .getDetail(id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({ next: (d) => this.meeting.set(d) });
    }

    toggleAudio(): void {
        this.api?.executeCommand('toggleAudio');
    }

    toggleVideo(): void {
        this.api?.executeCommand('toggleVideo');
    }

    toggleShare(): void {
        this.api?.executeCommand('toggleShareScreen');
    }

    toggleHand(): void {
        this.handRaised.update((v) => !v);
        this.api?.executeCommand('toggleRaiseHand');
    }

    toggleTileView(): void {
        this.api?.executeCommand('toggleTileView');
    }

    toggleCaptions(): void {
        this.captionsOn.update((v) => !v);
        this.syncSpeechRecognition();
        if (!this.captionsOn()) {
            this.activeCaption.set(null);
        }
    }

    setCaptionLanguage(lang: 'vi-VN' | 'en-US'): void {
        this.captionLang.set(lang);
        this.speechService.setLanguage(lang);
        const name = lang === 'vi-VN' ? this.t('vietnamese') : this.t('english');
        this.message.info(`${this.t('captionLang')}: ${name}`);
    }

    syncSpeechRecognition(): void {
        if (this.phase() === 'live' && this.captionsOn() && !this.audioMuted()) {
            this.speechService.startListening(this.captionLang());
        } else {
            this.speechService.stopListening();
        }
    }

    displayCaption(caption: MeetingCaptionDto): void {
        this.activeCaption.set(caption);
        if (this.captionTimer) clearTimeout(this.captionTimer);
        this.captionTimer = setTimeout(() => {
            this.activeCaption.set(null);
        }, 5500);
    }

    loadTranscripts(): void {
        const id = this.meetingId();
        if (!id) return;
        this.meetingService
            .getTranscripts(id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (items) => {
                    if (items && items.length > 0) {
                        this.transcripts.set(items);
                    }
                },
            });
    }

    copyAllTranscripts(): void {
        const list = this.transcripts();
        if (!list.length) return;
        const text = list
            .map((c) => {
                const time = c.timestamp ? new Date(c.timestamp).toLocaleTimeString() : '';
                const langLabel = c.language === 'en-US' ? 'EN' : 'VI';
                return `[${time}] [${langLabel}] ${c.speakerName}: ${c.text}`;
            })
            .join('\n');

        try {
            const done = navigator.clipboard?.writeText(text);
            if (done && typeof done.then === 'function') {
                void done.then(() => this.message.success(this.t('transcriptCopied')));
            } else {
                this.message.success(this.t('transcriptCopied'));
            }
        } catch {
            this.message.error('Không thể sao chép văn bản.');
        }
    }


    toggleRecording(): void {
        if (this.recording()) {
            this.api?.executeCommand('stopRecording');
        } else {
            this.api?.executeCommand('startRecording', { mode: 'file' });
        }
    }

    copyInvite(): void {
        const id = this.meetingId();
        if (!id) return;
        const url = `${window.location.origin}/meetings/${id}`;
        const successMsg = this.lang() === 'vi' ? 'Đã sao chép link mời.' : 'Invite link copied.';
        const failMsg = this.lang() === 'vi' ? 'Không sao chép được link mời.' : 'Could not copy invite link.';
        try {
            const done = navigator.clipboard?.writeText(url);
            if (done && typeof done.then === 'function') {
                void done.then(
                    () => this.message.success(successMsg),
                    () => this.message.error(failMsg)
                );
            } else {
                this.message.success(successMsg);
            }
        } catch {
            this.message.error(failMsg);
        }
    }

    private onDominantSpeaker(participantId: string | undefined): void {
        if (!participantId) {
            this.speakerName.set(null);
            return;
        }
        try {
            const withInfo = this.api as (JitsiApi & {
                getParticipantsInfo?: () => { participantId: string; displayName?: string }[];
            }) | null;
            const list = withInfo?.getParticipantsInfo?.() ?? [];
            const found = list.find((p) => p.participantId === participantId);
            this.speakerName.set(found?.displayName?.trim() ? found.displayName : null);
        } catch {
            this.speakerName.set(null);
        }
    }

    togglePanel(which: Exclude<SidePanel, null>): void {
        this.panel.update((p) => (p === which ? null : which));
        if (which === 'chat' && this.panel() === 'chat') {
            this.unread.set(0);
            this.loadChat();
            queueMicrotask(() => this.scrollChatToBottom());
        }
    }

    toggleLang(): void {
        this.lang.update((l) => (l === 'vi' ? 'en' : 'vi'));
    }

    toggleWhiteboard(): void {
        this.whiteboardOpen.update((v) => !v);
    }

    onWhiteboardSaved(): void {
        this.whiteboardOpen.set(false);
        this.panel.set('docs');
    }

    kickParticipant(userName: string): void {
        // Prefer BE removal is not kick — this is Jitsi kick only. Confirm intent.
        const api = this.api as (JitsiApi & {
            getParticipantsInfo?: () => { participantId: string; displayName?: string; email?: string }[];
        }) | null;
        try {
            const info = api?.getParticipantsInfo?.() ?? [];
            const me = this.meeting()?.participants.find((p) => p.userName === userName);
            if (!me) {
                this.message.error(this.t('kickFailed'));
                return;
            }
            // Try match by displayName then by email substring
            let target = info.find((p) => (p.displayName ?? '').trim() === me.fullName.trim() && p.displayName?.trim());
            if (!target && me.email) {
                target = info.find((p) => (p.email ?? '').toLowerCase().includes(me.email.toLowerCase()));
            }
            if (!target) {
                this.message.warning(
                    this.lang() === 'vi'
                        ? 'Không tìm thấy người này trong phòng Jitsi (có thể họ chưa vào).'
                        : 'Person not found in Jitsi room (may not have joined yet).'
                );
                return;
            }
            api?.executeCommand('kickParticipant', target.participantId);
        } catch {
            this.message.error(this.t('kickFailed'));
        }
    }

    removeFromMeeting(userName: string): void {
        const id = this.meetingId();
        if (!id) return;
        this.meetingService
            .removeParticipant(id, userName)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.message.success(this.lang() === 'vi' ? 'Đã xóa người tham gia.' : 'Participant removed.');
                    this.reloadDetail();
                },
                error: (err: Error) => this.message.error(err.message || 'Xóa thất bại.'),
            });
    }

    canEnd(): boolean {
        return this.meeting()?.isHost ?? false;
    }

    openEnd(): void {
        if (!this.canEnd()) return;
        this.endOpen.set(true);
    }

    closeEnd(): void {
        if (this.ending()) return;
        this.endOpen.set(false);
    }

    confirmEnd(): void {
        const id = this.meetingId();
        if (!id || this.ending()) return;
        this.ending.set(true);
        this.meetingService
            .end(id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: () => {
                    this.ending.set(false);
                    this.endOpen.set(false);
                    this.meeting.update((m) => (m ? { ...m, status: 3 } : m));
                    this.stopTimer();
                    this.phase.set('ended');
                    setTimeout(() => void this.leave(), 1800);
                },
                error: (err: Error) => {
                    this.ending.set(false);
                    this.message.error(err.message || this.t('endFailed'));
                },
            });
    }

    formatStartTime(iso: string | undefined): string {
        if (!iso) return '';
        const d = new Date(iso);
        const day = d.getDate().toString().padStart(2, '0');
        const month = (d.getMonth() + 1).toString().padStart(2, '0');
        const time = d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        return `${day}/${month}/${d.getFullYear()} · ${time}`;
    }

    private loadChat(): void {
        const id = this.meetingId();
        if (!id || this.chatLoaded) return;
        this.chatLoaded = true;
        this.meetingService
            .getMessages(id)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (messages) => {
                    this.chat.set(messages);
                    queueMicrotask(() => this.scrollChatToBottom());
                },
            });
    }

    sendChat(): void {
        const text = this.chatInput().trim();
        const id = this.meetingId();
        if (!text || text.length > 2000 || !id || this.sending()) return;
        this.sending.set(true);
        this.meetingService
            .sendMessage(id, text)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (msg) => {
                    this.sending.set(false);
                    this.chatInput.set('');
                    this.appendMessage(msg);
                    queueMicrotask(() => this.scrollChatToBottom());
                    // BE now broadcasts via SignalR — no client broadcast needed.
                },
                error: (err: Error) => {
                    this.sending.set(false);
                    this.message.error(err.message || 'Không gửi được tin nhắn.');
                },
            });
    }

    private appendMessage(msg: ChatMessage): void {
        if (!msg || this.chat().some((m) => m.id === msg.id)) return;
        this.chat.update((list) => [...list, msg]);
        if (this.panel() === 'chat') queueMicrotask(() => this.scrollChatToBottom());
    }

    private scrollChatToBottom(): void {
        const el = this.chatScroll()?.nativeElement;
        if (el) el.scrollTop = el.scrollHeight;
    }

    async leave(): Promise<void> {
        if (this.leaving) return;
        this.leaving = true;
        this.speechService.stopListening();
        if (this.captionTimer) clearTimeout(this.captionTimer);
        this.stopTimer();
        const id = this.meetingId();
        try {
            this.api?.dispose();
        } finally {
            this.api = null;
        }
        try {
            if (id) await this.hub.leaveRoom(id);
        } catch {
            // ignore
        }
        if (id) {
            await new Promise<void>((resolve) => {
                this.meetingService
                    .leave(id)
                    .pipe(takeUntilDestroyed(this.destroyRef))
                    .subscribe({ next: () => resolve(), error: () => resolve() });
            });
            await this.router.navigate(['/meetings', id]);
        } else {
            await this.router.navigate(['/meetings']);
        }
    }

    backToDetail(): void {
        void this.leave();
    }

    retry(): void {
        this.leaving = false;
        void this.enter();
    }

    roleLabel(role: number): string {
        const map: Record<number, string> = {
            [MeetingParticipantRole.Host]: 'Chủ trì',
            [MeetingParticipantRole.CoHost]: 'Đồng chủ trì',
            [MeetingParticipantRole.Secretary]: 'Thư ký',
            [MeetingParticipantRole.Required]: 'Bắt buộc',
            [MeetingParticipantRole.Optional]: 'Tùy chọn',
        };
        return map[role] ?? '';
    }

    initials(name: string): string {
        const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return '?';
        const first = parts[0][0] ?? '';
        const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
        return (first + last).toUpperCase();
    }

    formatElapsed(totalSeconds: number): string {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        const mm = h > 0 ? m.toString().padStart(2, '0') : m.toString();
        const ss = s.toString().padStart(2, '0');
        return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
    }

    formatChatTime(iso: string): string {
        if (!iso) return '';
        return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    }

    private fail(message: string): void {
        this.clearJoinTimeout();
        this.phase.set('error');
        this.errorMessage.set(message);
    }

    private clearJoinTimeout(): void {
        if (this.joinTimeout) {
            clearTimeout(this.joinTimeout);
            this.joinTimeout = null;
        }
    }

    private startTimer(): void {
        this.stopTimer();
        // Sync elapsed from meeting StartDate if available (official duration)
        const startIso = this.meeting()?.expectedStartTime;
        // Actually use live start if ongoing: calculate from now - meeting startDate? BE stores StartDate not exposed in Detail? Use expectedStart if ongoing within today.
        // Fallback: compute from server meeting's StartDate if available via activity log or assume now.
        // For now, if meeting has Started recently, elapsed = seconds since now - StartDate approximation via Date.now().
        // We keep simple interval from 0 but also try to sync if meeting.startDate exists in future BE field (fallback 0).
        const startedAt = this.meeting() as unknown as { startDate?: string };
        if (startedAt?.startDate) {
            const start = new Date(startedAt.startDate).getTime();
            const now = Date.now();
            const diff = Math.max(0, Math.floor((now - start) / 1000));
            this.elapsed.set(diff);
        } else {
            this.elapsed.set(0);
        }
        this.timer = setInterval(() => this.elapsed.update((e) => e + 1), 1000);
    }

    private stopTimer(): void {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}

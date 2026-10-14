import { Component, ElementRef, HostListener, NgZone, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subject, filter, finalize, interval, switchMap, takeUntil, throttleTime } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzNotificationService } from 'ng-zorro-antd/notification';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { GlobalService, SessionService, TokenService } from '../../../../core';
import { APP_RIGHTS } from '../../../../shared/constants';
import { RealtimeHubService } from '../../../../shared/services';
import { DateTimeUtils, JwtUtils } from '../../../../shared/utils';
import { MeetingDetail, MeetingSettings, MeetingStatus, defaultMeetingSettings } from '../../models/meeting.models';
import { Caption, EnterRoomResult, EnterState, JoinInfo, RoomParticipant } from '../../models/room.models';
import { MeetingService } from '../../services/meeting.service';
import { RoomService } from '../../services/room.service';
import { JitsiApi, JitsiService } from '../../services/jitsi.service';
import { SpeechRecognitionService } from '../../services/speech-recognition.service';
import { RoomPrejoin, PrejoinChoice } from './prejoin/prejoin';
import { RoomPeoplePanel } from './people-panel/people-panel';
import { RoomChatPanel } from './chat-panel/chat-panel';
import { RoomFilesPanel } from './files-panel/files-panel';
import { RoomTasksPanel } from './tasks-panel/tasks-panel';
import { RoomWhiteboard } from './whiteboard/whiteboard';

type Phase = 'loading' | 'prejoin' | 'waiting' | 'connecting' | 'room' | 'closed' | 'left' | 'kicked' | 'error';
type PanelTab = 'people' | 'chat' | 'files' | 'tasks';

interface CaptionLine { speaker: string; name: string; text: string; at: number }

/**
 * P10 — Phòng họp `/meetings/:id/join` (ngoài Shell, nền tối).
 * Chuẩn bị (thiết bị) → xin vào (room/enter: phòng chờ / chờ chủ trì) → join-info + hub JoinMeeting → Jitsi.
 * Mọi quyền (phòng chờ, tắt mic, mời ra, khóa bảng trắng, ghi hình) đều được BE kiểm tra lại.
 */
@Component({
  selector: 'app-meeting-room',
  standalone: true,
  imports: [SharedModules, RoomPrejoin, RoomPeoplePanel, RoomChatPanel, RoomFilesPanel, RoomTasksPanel, RoomWhiteboard],
  templateUrl: './meeting-room.html',
  styleUrl: './meeting-room.scss',
})
export class MeetingRoom implements OnInit, OnDestroy {
  @ViewChild('jitsiHost') jitsiHost?: ElementRef<HTMLElement>;

  private destroy$ = new Subject<void>();
  private leave$ = new Subject<void>();
  readonly MeetingStatus = MeetingStatus;

  meetingId = '';
  userName = '';
  displayName = '';
  isGuest = false;
  meeting: MeetingDetail | null = null;
  settings: MeetingSettings = defaultMeetingSettings();

  phase: Phase = 'loading';
  busy = false;
  errorText = '';
  closedState: 'ENDED' | 'CANCELLED' | 'NOT_READY' = 'ENDED';
  closedText = '';
  waitState: EnterState = 'LOBBY';
  waitText = '';
  isModerator = false;

  private choice: PrejoinChoice = { audioMuted: false, videoMuted: false, devices: {} };
  private clientSessionId = '';
  joinInfo: JoinInfo | null = null;
  private api: JitsiApi | null = null;
  jitsiError = '';
  /** Đã vào được hội nghị Jitsi (mic / camera / chia sẻ màn hình chỉ dùng được sau thời điểm này). */
  mediaReady = false;
  private mediaTimer: ReturnType<typeof setTimeout> | null = null;

  audioMuted = false;
  videoMuted = false;
  sharing = false;
  recording = false;
  captionsOn = false;
  whiteboardOpen = false;
  panelOpen = true;
  panelTab: PanelTab = 'people';
  unreadChat = 0;
  lobbyCount = 0;
  onlineCount = 0;
  privateTo: RoomParticipant | null = null;
  canRecord = false;

  captions: CaptionLine[] = [];
  now = Date.now();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private tokens: TokenService,
    private session: SessionService,
    private global: GlobalService,
    private meetings: MeetingService,
    private room: RoomService,
    private hub: RealtimeHubService,
    private jitsi: JitsiService,
    readonly speech: SpeechRecognitionService,
    private message: NzMessageService,
    private notify: NzNotificationService,
    private zone: NgZone,
  ) { }

  // ===================== Khởi tạo =====================

  ngOnInit(): void {
    this.meetingId = this.route.snapshot.paramMap.get('id') ?? '';
    this.isGuest = this.tokens.isGuestFor(this.meetingId);
    if (this.isGuest) {
      const claims = JwtUtils.parsePayload(this.tokens.getAccessToken());
      // BE đặt tên đăng nhập vào claim name kiểu .NET (JwtTokenService.NAME_CLAIM).
      this.userName = String(claims?.['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name'] ?? '');
      this.displayName = String(claims?.['FullName'] ?? 'Khách');
    } else {
      const info = this.session.accountInfo;
      this.userName = info?.userName ?? '';
      this.displayName = info?.fullName || info?.userName || '';
      this.canRecord = this.session.isAdmin || this.global.hasRight(APP_RIGHTS.MEETING_RECORD);
    }

    void this.hub.start();
    this.listen();
    interval(1000).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.now = Date.now();
      // Phụ đề tự ẩn sau 6 giây không nói.
      if (this.captions.some(c => this.now - c.at > 6000)) this.captions = this.captions.filter(c => this.now - c.at <= 6000);
    });
    this.load();
  }

  ngOnDestroy(): void {
    this.teardown();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Đóng tab / F5: báo rời phòng (hub tự ghi "rời" khi kết nối đóng). */
  @HostListener('window:beforeunload')
  onUnload(): void {
    if (this.phase === 'room') this.room.markLeft(this.meetingId);
  }

  private load(): void {
    this.phase = 'loading';
    this.meetings.detail(this.meetingId, false).pipe(takeUntil(this.destroy$)).subscribe({
      next: d => this.onDetail(d),
      error: (err: HttpErrorResponse) => {
        if (err?.status === 403 && !this.isGuest) {
          // Chưa là thành viên: cuộc họp Nội bộ / Công khai → room/enter thêm vào rồi tải lại.
          this.room.enter(this.meetingId).pipe(takeUntil(this.destroy$)).subscribe({
            next: () => this.meetings.detail(this.meetingId, false).subscribe(d => this.onDetail(d)),
            error: () => this.fail('Cuộc họp chỉ dành cho người được mời.'),
          });
          return;
        }
        this.fail(err?.status === 404 ? 'Không tìm thấy cuộc họp.' : 'Bạn không có quyền vào cuộc họp này.');
      },
    });
  }

  private onDetail(d: MeetingDetail): void {
    this.meeting = d;
    this.settings = { ...defaultMeetingSettings(), ...(d.settings ?? {}) };
    this.isModerator = d.isHost;
    document.title = `${d.name} · Smart Meeting`;
    if (d.status === MeetingStatus.Cancelled) return this.close('CANCELLED', d.cancellationReason ? `Lý do: ${d.cancellationReason}` : '');
    if (d.status === MeetingStatus.Ended || d.status === MeetingStatus.Archived) return this.close('ENDED', '');
    if (d.status === MeetingStatus.Draft) return this.close('NOT_READY', '');
    if (this.phase === 'loading') this.phase = 'prejoin';
  }

  private fail(text: string): void {
    this.errorText = text;
    this.phase = 'error';
  }

  private close(state: 'ENDED' | 'CANCELLED' | 'NOT_READY', text: string): void {
    this.teardown();
    this.closedState = state;
    this.closedText = text;
    this.phase = 'closed';
  }

  // ===================== Sự kiện realtime =====================

  private listen(): void {
    this.hub.roomEvent
      .pipe(filter(e => e.payload?.meetingId === this.meetingId), takeUntil(this.destroy$))
      .subscribe(e => {
        const p = e.payload;
        switch (e.name) {
          case 'LobbyDecision':
            if (this.phase === 'waiting') {
              if (p.state === 'ADMITTED') this.enterRoom();
              else this.setWaiting('REJECTED', 'Chủ trì chưa cho bạn vào phòng.');
            }
            break;
          case 'MeetingStatusChanged':
            if (p.status === MeetingStatus.Ended) this.close('ENDED', this.isModerator ? '' : 'Chủ trì đã kết thúc cuộc họp.');
            if (p.status === MeetingStatus.Cancelled) this.close('CANCELLED', '');
            break;
          case 'Kicked':
            if (this.phase === 'room' || this.phase === 'connecting') {
              this.teardown();
              this.phase = 'kicked';
            }
            break;
          case 'ForceMute':
            if (this.api && !this.audioMuted) {
              this.api.executeCommand('toggleAudio');
              this.message.warning('Chủ trì đã tắt micro của bạn');
            }
            break;
          case 'RoleChanged':
            this.isModerator = p.role === 1;
            this.message.info(this.isModerator ? 'Bạn đã được chỉ định làm chủ trì' : 'Vai trò của bạn vừa được thay đổi');
            break;
          case 'LobbyChanged':
            if (this.isModerator && this.phase === 'room' && p.pending > this.lobbyCount) {
              this.notify.info('Phòng chờ', `${p.pending} người đang chờ vào phòng`, { nzPlacement: 'bottomLeft', nzDuration: 4000 });
              this.panelOpen = true;
              this.panelTab = 'people';
            }
            this.lobbyCount = p.pending ?? this.lobbyCount;
            break;
          case 'RecordingChanged':
            if (p.by !== this.userName) {
              this.recording = !!p.on;
              this.message.info(p.on ? 'Cuộc họp đang được ghi hình' : 'Đã dừng ghi hình');
            }
            break;
          case 'ReceiveCaption':
            this.onCaption(p as Caption);
            break;
        }
      });

    // Chờ chủ trì bắt đầu: thông báo MEETING_STARTED → thử vào lại ngay.
    this.hub.notificationCreated
      .pipe(filter(e => e?.notification?.type === 'MEETING_STARTED' && e.notification.meetingId === this.meetingId), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.phase === 'waiting' && this.waitState === 'WAIT_HOST') this.retryEnter();
      });

    // Kết nối hub rớt rồi nối lại → vào lại phòng realtime (RealtimeHubService tự JoinMeeting lại).
    // Dự phòng khi đang chờ: hỏi lại mỗi 8 giây.
    interval(8000).pipe(filter(() => this.phase === 'waiting' && this.waitState !== 'REJECTED'), takeUntil(this.destroy$))
      .subscribe(() => this.retryEnter());
  }

  // ===================== Vào phòng =====================

  get isHost(): boolean {
    return !!this.meeting?.isHost;
  }

  get primaryLabel(): string {
    if (this.isHost && this.meeting?.status === MeetingStatus.Scheduled) return 'Bắt đầu cuộc họp';
    return this.settings.lobbyEnabled && !this.isHost ? 'Xin vào phòng' : 'Vào phòng';
  }

  onChoice(choice: PrejoinChoice): void {
    this.choice = choice;
    this.audioMuted = choice.audioMuted;
    this.videoMuted = choice.videoMuted;
    this.busy = true;
    const enter$: Observable<EnterRoomResult> = this.isHost && this.meeting?.status === MeetingStatus.Scheduled
      ? this.room.start(this.meetingId).pipe(switchMap(() => this.room.enter(this.meetingId)))
      : this.room.enter(this.meetingId);
    enter$.pipe(finalize(() => this.busy = false), takeUntil(this.destroy$)).subscribe({
      next: res => this.handleEnter(res),
      error: () => { /* CommonService đã báo lỗi */ },
    });
  }

  private handleEnter(res: EnterRoomResult): void {
    this.isModerator = res.isModerator;
    switch (res.state) {
      case 'ADMITTED':
        this.enterRoom();
        break;
      case 'LOBBY':
      case 'WAIT_HOST':
      case 'REJECTED':
        this.setWaiting(res.state, res.message ?? '');
        break;
      case 'ENDED':
      case 'CANCELLED':
      case 'NOT_READY':
        this.close(res.state, '');
        break;
    }
  }

  private setWaiting(state: EnterState, text: string): void {
    this.waitState = state;
    this.waitText = text;
    this.phase = 'waiting';
  }

  private retryEnter(): void {
    this.room.enter(this.meetingId).pipe(takeUntil(this.destroy$)).subscribe(res => {
      if (this.phase === 'waiting') this.handleEnter(res);
    });
  }

  requestAgain(): void {
    this.busy = true;
    this.room.requestAgain(this.meetingId).pipe(finalize(() => this.busy = false), takeUntil(this.destroy$))
      .subscribe(res => this.handleEnter(res));
  }

  cancelWaiting(): void {
    this.phase = 'prejoin';
  }

  private enterRoom(): void {
    if (this.phase === 'connecting' || this.phase === 'room') return;
    this.phase = 'connecting';
    this.clientSessionId = (crypto as any).randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    this.room.joinInfo(this.meetingId).pipe(takeUntil(this.destroy$)).subscribe({
      next: async info => {
        this.joinInfo = info;
        try {
          await this.hub.joinMeeting(this.meetingId, this.clientSessionId);
        } catch {
          this.message.warning('Chưa kết nối được realtime — chat, phụ đề, bảng trắng có thể chậm.');
        }
        this.room.markJoined(this.meetingId).subscribe({ error: () => { } });
        // Làm mới trạng thái (vừa bắt đầu → có giờ bắt đầu thực tế cho đồng hồ).
        this.meetings.detail(this.meetingId, false).subscribe({ next: d => this.meeting = d, error: () => { } });
        this.zone.run(() => {
          this.phase = 'room';
          setTimeout(() => this.startJitsi());
        });
      },
      error: () => this.retryEnter(),
    });
  }

  private async startJitsi(): Promise<void> {
    const host = this.jitsiHost?.nativeElement;
    const info = this.joinInfo;
    if (!host || !info) return;
    this.jitsiError = '';
    try {
      this.api = await this.jitsi.createRoom({
        domain: info.domain,
        externalApiUrl: info.externalApiUrl,
        roomName: info.roomName,
        displayName: this.displayName,
        subject: info.name,
        startWithAudioMuted: this.choice.audioMuted,
        startWithVideoMuted: this.choice.videoMuted,
        parentNode: host,
        devices: this.choice.devices,
      });
      const on = (event: string, fn: (p: any) => void) => this.api!.addEventListener(event, p => this.zone.run(() => fn(p ?? {})));
      on('audioMuteStatusChanged', p => this.audioMuted = !!p.muted);
      on('videoMuteStatusChanged', p => this.videoMuted = !!p.muted);
      on('screenSharingStatusChanged', p => this.sharing = !!p.on);
      on('recordingStatusChanged', p => this.recording = !!p.on);
      on('readyToClose', () => this.leave());
      on('videoConferenceJoined', () => {
        this.mediaReady = true;
        this.jitsiError = '';
        this.clearMediaTimer();
      });
      // Máy chủ Jitsi lỗi (ví dụ thiếu config.js) thì iframe vẫn tải nhưng không bao giờ vào được hội nghị.
      this.clearMediaTimer();
      this.mediaTimer = setTimeout(() => this.zone.run(() => {
        if (!this.mediaReady && this.api) {
          this.jitsiError = `Không kết nối được máy chủ video (${info.domain}). Micro, camera và chia sẻ màn hình chưa dùng được; chat, phụ đề, bảng trắng vẫn hoạt động. Hãy báo quản trị viên kiểm tra máy chủ Jitsi.`;
        }
      }), 20000);
    } catch (e: any) {
      this.jitsiError = e?.message || 'Không tải được video (Jitsi). Các chức năng khác vẫn dùng được.';
    }
  }

  // ===================== Thanh điều khiển =====================

  toggleAudio(): void {
    if (this.mediaAvailable()) this.api?.executeCommand('toggleAudio');
  }

  toggleVideo(): void {
    if (this.mediaAvailable()) this.api?.executeCommand('toggleVideo');
  }

  /** Chưa vào được hội nghị video thì báo lý do thay vì bấm không có gì xảy ra. */
  private mediaAvailable(): boolean {
    if (this.mediaReady) return true;
    this.message.warning(this.jitsiError || 'Đang kết nối máy chủ video, vui lòng thử lại sau vài giây.');
    return false;
  }

  private clearMediaTimer(): void {
    if (this.mediaTimer) clearTimeout(this.mediaTimer);
    this.mediaTimer = null;
  }

  get canShare(): boolean {
    return this.settings.screenShareEnabled || this.isModerator;
  }

  toggleShare(): void {
    if (this.canShare && this.mediaAvailable()) this.api?.executeCommand('toggleShareScreen');
  }

  /** Tạo việc trong phòng: mọi thành viên (khách không có tab Công việc), trừ cuộc họp đã hủy / lưu trữ. */
  get canCreateTask(): boolean {
    const st = this.meeting?.status;
    return !this.isGuest && st !== MeetingStatus.Cancelled && st !== MeetingStatus.Archived;
  }

  get canCaption(): boolean {
    return this.settings.captionsEnabled || this.isModerator;
  }

  private captionSub: { unsubscribe(): void } | null = null;
  private captionSegment = '';

  toggleCaptions(): void {
    if (!this.canCaption) return;
    this.captionsOn = !this.captionsOn;
    if (!this.captionsOn) {
      this.speech.stopListening();
      this.captionSub?.unsubscribe();
      this.captionSub = null;
      return;
    }
    if (!this.speech.isSupported()) {
      this.message.warning('Trình duyệt không hỗ trợ nhận dạng giọng nói (dùng Chrome hoặc Edge).');
      this.captionsOn = false;
      return;
    }
    this.captionSegment = this.newId();
    this.speech.startListening('vi-VN');
    // Kết quả tạm gửi tối đa ~3 lần/giây; kết quả cuối luôn gửi (BE lưu vào transcript).
    this.captionSub = this.speech.captionResult
      .pipe(throttleTime(300, undefined, { leading: true, trailing: true }), takeUntil(this.leave$))
      .subscribe(r => {
        if (this.audioMuted) return;
        this.hub.sendCaption(this.meetingId, {
          id: this.captionSegment, meetingId: this.meetingId, text: r.text, language: r.language,
          isFinal: r.isFinal, timestamp: new Date().toISOString(),
        });
        if (r.isFinal) this.captionSegment = this.newId();
      });
  }

  /** Trạng thái phụ đề của chính mình khi chưa có dòng nào hiển thị — để không "bật mà im lặng". */
  get captionHint(): string | null {
    if (!this.captionsOn) return null;
    const error = this.speech.errorMessage();
    if (error) return `Phụ đề không hoạt động: ${error}`;
    if (this.audioMuted) return 'Mic đang tắt nên lời bạn nói chưa được ghi phụ đề. Bật mic để bắt đầu.';
    return this.speech.isListening() ? 'Phụ đề đang bật — hãy nói để hiển thị.' : 'Đang khởi động nhận dạng giọng nói…';
  }

  private onCaption(c: Caption): void {
    const line: CaptionLine = { speaker: c.speakerUserName, name: c.speakerName, text: c.text, at: Date.now() };
    const others = this.captions.filter(x => x.speaker !== c.speakerUserName);
    this.captions = [...others, line].slice(-3);
  }

  get canRecordHere(): boolean {
    return this.isModerator && this.canRecord && this.settings.recordingEnabled;
  }

  toggleRecording(): void {
    if (!this.canRecordHere) return;
    const on = !this.recording;
    this.room.recording(this.meetingId, on).subscribe(() => {
      this.api?.executeCommand(on ? 'startRecording' : 'stopRecording', ...(on ? [{ mode: 'file' }] : ['file']));
      this.recording = on;
    });
  }

  get canWhiteboard(): boolean {
    return this.settings.whiteboardEnabled || this.isModerator;
  }

  toggleWhiteboard(): void {
    if (this.canWhiteboard) this.whiteboardOpen = !this.whiteboardOpen;
  }

  openPanel(tab: PanelTab): void {
    if (this.panelOpen && this.panelTab === tab) {
      this.panelOpen = false;
      return;
    }
    this.panelOpen = true;
    this.panelTab = tab;
  }

  onPrivateChat(p: RoomParticipant): void {
    this.privateTo = p;
    this.openPanel('chat');
  }

  get canUploadFiles(): boolean {
    return !this.isGuest && (this.settings.fileUploadEnabled || this.isModerator);
  }

  // ===================== Rời / kết thúc =====================

  leave(): void {
    this.teardown();
    this.phase = 'left';
  }

  endMeeting(): void {
    this.room.end(this.meetingId).pipe(takeUntil(this.destroy$)).subscribe(() => this.close('ENDED', 'Bạn đã kết thúc cuộc họp.'));
  }

  rejoin(): void {
    this.phase = 'prejoin';
    this.load();
  }

  backToList(): void {
    if (this.isGuest) {
      this.tokens.clearGuest();
      this.router.navigate(['/login']);
      return;
    }
    this.router.navigate(this.meeting ? ['/meetings', this.meetingId] : ['/meetings']);
  }

  private teardown(): void {
    this.leave$.next();
    if (this.captionsOn) {
      this.speech.stopListening();
      this.captionsOn = false;
    }
    this.captionSub?.unsubscribe();
    this.captionSub = null;
    try { this.api?.dispose(); } catch { /* iframe đã đóng */ }
    this.api = null;
    this.mediaReady = false;
    this.clearMediaTimer();
    if (this.phase === 'room' || this.phase === 'connecting') {
      void this.hub.leaveMeeting(this.meetingId);
      this.room.markLeft(this.meetingId);
    }
    this.whiteboardOpen = false;
    this.captions = [];
  }

  // ===================== Hiển thị =====================

  get elapsed(): string {
    const start = DateTimeUtils.fromUtc(this.meeting?.actualStartTime);
    if (!start) return '';
    const s = Math.max(0, Math.floor((this.now - start.getTime()) / 1000));
    const pad = (n: number) => String(n).padStart(2, '0');
    const h = Math.floor(s / 3600);
    return `${h ? h + ':' : ''}${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  }

  get startText(): Date | null {
    return DateTimeUtils.fromUtc(this.meeting?.expectedStartTime);
  }

  private newId(): string {
    return (crypto as any).randomUUID?.() ?? `${Date.now()}${Math.random().toString(36).slice(2)}`;
  }
}

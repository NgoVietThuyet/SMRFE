import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, filter, finalize, switchMap, takeUntil } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzQRCodeModule } from 'ng-zorro-antd/qr-code';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { GlobalService, SessionService } from '../../../../core';
import { APP_RIGHTS } from '../../../../shared/constants';
import { RealtimeHubService, UploadPolicyService } from '../../../../shared/services';
import { DateTimeUtils, FileUtils } from '../../../../shared/utils';
import { TaskListItem } from '../../../dashboard/models/dashboard.models';
import {
  MeetingActivity, MeetingDetail, MeetingFile, MeetingListItem, MeetingParticipant, MeetingRole, MeetingSettings, MeetingStatus, UserSearchItem,
} from '../../models/meeting.models';
import { MeetingService } from '../../services/meeting.service';
import { RoomService } from '../../services/room.service';
import { AttendanceSummary } from '../../models/room.models';
import {
  MEETING_ACTIVITY_LABELS, MEETING_ASSIGNABLE_ROLES, MEETING_STATUS_META, MeetingActions, copyText, meetingInviteText,
  meetingJoinLink, roleMeta, visibilityLabel,
} from '../../utils/meeting-ui';
import { MeetingForm } from '../meeting-form/meeting-form';
import { CancelMeetingModal } from '../cancel-meeting-modal/cancel-meeting-modal';
import { ShareMeetingModal } from '../share-meeting-modal/share-meeting-modal';
import { MinutesSummary } from '../../../minutes/components/minutes-summary/minutes-summary';

type DetailTab = 'overview' | 'people' | 'files' | 'minutes' | 'tasks' | 'activity';

const SETTING_LABELS: { key: keyof MeetingSettings; label: string }[] = [
  { key: 'lobbyEnabled', label: 'Phòng chờ' },
  { key: 'allowGuests', label: 'Cho phép khách' },
  { key: 'allowJoinBeforeHost', label: 'Vào trước chủ trì' },
  { key: 'chatEnabled', label: 'Chat' },
  { key: 'screenShareEnabled', label: 'Chia sẻ màn hình' },
  { key: 'whiteboardEnabled', label: 'Bảng trắng' },
  { key: 'fileUploadEnabled', label: 'Tải tài liệu trong phòng' },
  { key: 'recordingEnabled', label: 'Ghi hình' },
  { key: 'captionsEnabled', label: 'Phụ đề' },
  { key: 'aiMinutesEnabled', label: 'Biên bản AI' },
];

const TASK_STATUS: Record<number, { label: string; color: string }> = {
  0: { label: 'Chưa bắt đầu', color: 'default' },
  1: { label: 'Đang làm', color: 'processing' },
  2: { label: 'Hoàn thành', color: 'success' },
};

/** P9 — Trang chi tiết cuộc họp `/meetings/:id`. Query `?tab=` chọn tab mở sẵn. */
@Component({
  selector: 'app-meeting-detail',
  standalone: true,
  imports: [SharedModules, NzQRCodeModule, NzTimelineModule, MeetingForm, CancelMeetingModal, ShareMeetingModal, MinutesSummary],
  templateUrl: './meeting-detail.html',
  styleUrl: './meeting-detail.scss',
})
export class MeetingDetailPage implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  readonly search$ = new Subject<string>();

  readonly tabs: DetailTab[] = ['overview', 'people', 'files', 'minutes', 'tasks', 'activity'];
  readonly statusMeta = MEETING_STATUS_META;
  readonly actions = MeetingActions;
  readonly roleOptions = MEETING_ASSIGNABLE_ROLES;
  readonly roleMeta = roleMeta;
  readonly visibilityLabel = visibilityLabel;
  readonly settingLabels = SETTING_LABELS;
  readonly taskStatus = TASK_STATUS;
  readonly MeetingStatus = MeetingStatus;
  readonly fileSize = (bytes: number) => FileUtils.getHumanFileSize(Number(bytes) || 0, 1);

  meetingId = '';
  meeting: MeetingDetail | null = null;
  loadError: 403 | 404 | null = null;
  isLoading = false;
  tabIndex = 0;
  busy = false;

  // Người tham gia
  addUser: string | null = null;
  addRole: MeetingRole = MeetingRole.Required;
  searchOptions: UserSearchItem[] = [];
  searching = false;

  // Tài liệu
  files: MeetingFile[] = [];
  filesLoaded = false;
  uploading = false;
  canUpload = false;
  canDownload = false;

  // Tham dự (chủ trì)
  attendance = new Map<string, AttendanceSummary>();
  exporting = false;

  // Công việc
  tasks: TaskListItem[] = [];
  tasksLoaded = false;

  // Drawer / modal
  formVisible = false;
  cancelTarget: MeetingListItem | null = null;
  shareTarget: MeetingListItem | null = null;

  constructor(
    private global: GlobalService,
    private session: SessionService,
    private service: MeetingService,
    private room: RoomService,
    private hub: RealtimeHubService,
    private route: ActivatedRoute,
    public router: Router,
    private message: NzMessageService,
    readonly uploadPolicy: UploadPolicyService,
  ) { }

  ngOnInit(): void {
    const isAdmin = this.session.isAdmin;
    this.canUpload = isAdmin || this.global.hasRight(APP_RIGHTS.FILE_UPLOAD);
    this.canDownload = isAdmin || this.global.hasRight(APP_RIGHTS.FILE_DOWNLOAD);

    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.meetingId = params.get('id') ?? '';
      this.files = [];
      this.tasks = [];
      this.filesLoaded = this.tasksLoaded = false;
      const tab = this.route.snapshot.queryParamMap.get('tab') as DetailTab | null;
      this.tabIndex = Math.max(0, this.tabs.indexOf(tab ?? 'overview'));
      this.load(true);
    });

    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => {
        this.searching = true;
        return this.service.searchUsers(q.trim(), 10).pipe(finalize(() => this.searching = false));
      }),
      takeUntil(this.destroy$),
    ).subscribe(list => {
      const taken = new Set((this.meeting?.participants ?? []).map(p => p.userName.toLowerCase()));
      this.searchOptions = (list ?? []).filter(u => !taken.has(u.userName.toLowerCase()));
    });

    // Cuộc họp bị hủy / dời giờ / bắt đầu → tải lại.
    this.hub.notificationCreated
      .pipe(filter(e => e?.notification?.type?.startsWith('MEETING_') && (e.notification.meetingId === this.meetingId || e.notification.resourceId === this.meetingId)),
        debounceTime(500), takeUntil(this.destroy$))
      .subscribe(() => this.load(false));
  }

  ngOnDestroy(): void {
    this.global.setBreadcrumb([]);
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===================== Tải dữ liệu =====================

  load(showLoading: boolean): void {
    if (!this.meetingId) return;
    this.isLoading = showLoading;
    this.service.detail(this.meetingId, false)
      .pipe(finalize(() => this.isLoading = false), takeUntil(this.destroy$))
      .subscribe({
        next: d => {
          this.meeting = d;
          this.loadError = null;
          this.global.setBreadcrumb([
            { name: 'Cuộc họp của tôi', path: 'meetings' },
            { name: d.name, path: `meetings/${d.id}` },
          ]);
          this.loadTabData();
        },
        error: err => {
          this.meeting = null;
          this.loadError = err?.status === 403 ? 403 : 404;
        },
      });
  }

  onTabChange(index: number): void {
    this.tabIndex = index;
    this.router.navigate([], {
      relativeTo: this.route, replaceUrl: true,
      queryParams: { tab: index === 0 ? null : this.tabs[index] }, queryParamsHandling: 'merge',
    });
    this.loadTabData();
  }

  /** Tab Tài liệu / Công việc chỉ tải khi mở lần đầu. */
  private loadTabData(): void {
    const tab = this.tabs[this.tabIndex];
    if (tab === 'people' && this.meeting?.isHost && this.meeting.actualStartTime) this.loadAttendance();
    if (tab === 'files' && !this.filesLoaded) this.loadFiles();
    if (tab === 'tasks' && !this.tasksLoaded) this.loadTasks();
  }

  loadFiles(): void {
    this.service.files(this.meetingId).pipe(takeUntil(this.destroy$)).subscribe(list => {
      this.files = list ?? [];
      this.filesLoaded = true;
    });
  }

  loadTasks(): void {
    this.service.tasks(this.meetingId).pipe(takeUntil(this.destroy$)).subscribe(res => {
      this.tasks = res?.items ?? [];
      this.tasksLoaded = true;
    });
  }

  // ===================== Hiển thị =====================

  date(value: string | null | undefined): Date | null {
    return DateTimeUtils.fromUtc(value);
  }

  weekday(d: Date): string {
    return ['Chủ nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'][d.getDay()];
  }

  get link(): string {
    return this.meeting ? meetingJoinLink(this.meeting.roomCode) : '';
  }

  get isReadOnly(): boolean {
    const s = this.meeting?.status;
    return s === MeetingStatus.Cancelled || s === MeetingStatus.Archived || s === MeetingStatus.Ended;
  }

  get canManagePeople(): boolean {
    return !!this.meeting?.isHost && !this.isReadOnly;
  }

  get agendaLines(): string[] {
    return (this.meeting?.agenda ?? '').split('\n').map(l => l.trim()).filter(Boolean);
  }

  get enabledSettings(): string[] {
    const s = this.meeting?.settings;
    if (!s) return [];
    return SETTING_LABELS.filter(i => !!s[i.key]).map(i => i.label);
  }

  get joinedCount(): number {
    return (this.meeting?.participants ?? []).filter(p => p.isJoined || p.joinTime).length;
  }

  get sortedParticipants(): MeetingParticipant[] {
    return [...(this.meeting?.participants ?? [])].sort((a, b) => a.role - b.role || a.fullName.localeCompare(b.fullName, 'vi'));
  }

  actorName(userName: string): string {
    const p = this.meeting?.participants?.find(x => x.userName.toLowerCase() === (userName ?? '').toLowerCase());
    return p?.fullName ?? userName;
  }

  activityLabel(a: MeetingActivity): string {
    return MEETING_ACTIVITY_LABELS[a.action] ?? a.action;
  }

  /** BE ghi payload là câu mô tả chung; chỉ hủy / xóa người mới có thông tin thêm (lý do, tên người). */
  activityDetail(a: MeetingActivity): string {
    if (a.action !== 'CANCEL' && a.action !== 'REMOVE_PARTICIPANT') return '';
    const text = a.payloadJson ?? '';
    const i = text.indexOf(':');
    return i >= 0 ? text.slice(i + 1).trim() : text;
  }

  activityColor(a: MeetingActivity): string {
    if (a.action === 'CANCEL' || a.action === 'DELETE' || a.action === 'REMOVE_PARTICIPANT') return 'red';
    if (a.action === 'START' || a.action === 'CREATE' || a.action === 'CREATE_QUICK' || a.action === 'PUBLISH') return 'green';
    return 'blue';
  }

  isMe(userName: string): boolean {
    return userName.toLowerCase() === (this.session.accountInfo?.userName ?? '').toLowerCase();
  }

  // ===================== Thao tác cuộc họp =====================

  join(): void {
    this.router.navigate(['/meetings', this.meetingId, 'join']);
  }

  start(): void {
    if (this.busy) return;
    this.busy = true;
    this.service.start(this.meetingId)
      .pipe(finalize(() => this.busy = false), takeUntil(this.destroy$))
      .subscribe(() => this.join());
  }

  archive(): void {
    this.service.archive(this.meetingId).pipe(takeUntil(this.destroy$)).subscribe(() => this.load(false));
  }

  remove(): void {
    this.service.remove(this.meetingId).pipe(takeUntil(this.destroy$)).subscribe(() => this.router.navigate(['/meetings']));
  }

  copyInvite(): void {
    if (!this.meeting) return;
    this.copy(meetingInviteText(this.meeting), 'Đã sao chép lời mời');
  }

  copy(text: string, done: string): void {
    copyText(text).then(ok => ok ? this.message.success(done) : this.message.warning('Trình duyệt không cho phép sao chép'));
  }

  onSaved(detail: MeetingDetail): void {
    if (detail) this.meeting = detail;
    this.load(false);
  }

  // ===================== Người tham gia =====================

  addParticipant(): void {
    if (!this.addUser || this.busy) return;
    this.busy = true;
    this.service.addParticipants(this.meetingId, [{ userName: this.addUser, role: this.addRole }])
      .pipe(finalize(() => this.busy = false), takeUntil(this.destroy$))
      .subscribe(d => {
        if (d) this.meeting = d;
        this.addUser = null;
        this.addRole = MeetingRole.Required;
        this.searchOptions = [];
      });
  }

  removeParticipant(p: MeetingParticipant): void {
    this.service.removeParticipant(this.meetingId, p.userName)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.load(false));
  }

  canRemove(p: MeetingParticipant): boolean {
    if (!this.canManagePeople || this.isMe(p.userName)) return false;
    // Không mời ra khi đang họp ở trang này (làm trong phòng họp, P10); không xóa chủ trì (người tạo).
    if (this.meeting?.status === MeetingStatus.Ongoing) return false;
    return p.role !== MeetingRole.Host;
  }

  // ===================== Tham dự =====================

  loadAttendance(): void {
    this.room.attendance(this.meetingId).pipe(takeUntil(this.destroy$)).subscribe({
      next: list => this.attendance = new Map((list ?? []).map(a => [a.userName.toLowerCase(), a])),
      error: () => { },
    });
  }

  durationOf(p: MeetingParticipant): string {
    const a = this.attendance.get(p.userName.toLowerCase());
    if (!a || !a.totalSeconds) return '';
    const m = Math.round(a.totalSeconds / 60);
    return m >= 60 ? `${Math.floor(m / 60)} giờ ${m % 60} phút` : `${m} phút`;
  }

  get hasAttendance(): boolean {
    return this.attendance.size > 0;
  }

  exportAttendance(): void {
    if (this.exporting) return;
    this.exporting = true;
    this.room.exportAttendance(this.meetingId)
      .pipe(finalize(() => this.exporting = false), takeUntil(this.destroy$))
      .subscribe(({ blob, fileName }) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      });
  }

  // ===================== Tài liệu =====================

  get canUploadHere(): boolean {
    return this.canUpload && !!this.meeting && this.meeting.status !== MeetingStatus.Cancelled && this.meeting.status !== MeetingStatus.Archived;
  }

  onFilePicked(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = Array.from(input.files ?? []);
    input.value = '';
    this.uploadNext(picked);
  }

  /** Tải lần lượt từng file (BE nhận một file mỗi request). */
  private uploadNext(queue: File[]): void {
    const file = queue.shift();
    if (!file) {
      this.uploading = false;
      return;
    }
    const error = this.uploadPolicy.check(file);
    if (error) {
      this.message.warning(`${file.name}: ${error}`);
      this.uploadNext(queue);
      return;
    }
    this.uploading = true;
    this.service.uploadFile(this.meetingId, file)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: f => {
          if (f) this.files = [f, ...this.files];
          this.message.success(`Đã tải lên ${file.name}`);
          this.uploadNext(queue);
        },
        error: () => this.uploadNext(queue),
      });
  }

  download(f: MeetingFile): void {
    this.service.downloadUrl(f.id).pipe(takeUntil(this.destroy$)).subscribe(res => {
      if (res?.url) window.open(res.url, '_blank', 'noopener');
    });
  }

  fileIcon(f: MeetingFile): string {
    return this.global.getFileIcon(f.mimeType);
  }

  // ===================== Công việc =====================

  openTask(t: TaskListItem): void {
    this.router.navigate(['/tasks'], { queryParams: { focus: t.id } });
  }

  isOverdue(t: TaskListItem): boolean {
    const due = DateTimeUtils.fromUtc(t.dueDate);
    return !!due && t.status !== 2 && due.getTime() < Date.now();
  }
}

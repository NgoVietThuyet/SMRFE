import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { Observable, Subject, concat, debounceTime, distinctUntilChanged, finalize, map, of, switchMap, takeUntil, toArray } from 'rxjs';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { SessionService } from '../../../../core';
import { DateTimeUtils } from '../../../../shared/utils';
import {
  MeetingDetail, MeetingRole, MeetingSettings, MeetingStatus, MeetingVisibility, ScheduleConflict, UserSearchItem,
  defaultMeetingSettings,
} from '../../models/meeting.models';
import { MeetingService } from '../../services/meeting.service';
import { MEETING_ASSIGNABLE_ROLES, MEETING_VISIBILITY_OPTIONS, roleMeta } from '../../utils/meeting-ui';

/** Một dòng trong bảng thành phần của drawer. */
interface ParticipantRow {
  userName: string;
  fullName: string;
  email: string;
  role: MeetingRole;
  /** Đã có trong cuộc họp trước khi mở drawer (chế độ sửa) → không đổi vai trò ở đây. */
  existing: boolean;
  /** Chính người đang đăng nhập (người tạo, luôn là chủ trì). */
  isMe: boolean;
}

/** Nhóm công tắc ở tab "Cài đặt phòng". */
const SETTING_ITEMS: { key: keyof MeetingSettings; label: string; hint: string }[] = [
  { key: 'lobbyEnabled', label: 'Phòng chờ', hint: 'Chủ trì duyệt từng người trước khi vào' },
  { key: 'allowGuests', label: 'Cho phép khách', hint: 'Người ngoài hệ thống vào bằng link (P10)' },
  { key: 'allowJoinBeforeHost', label: 'Vào trước chủ trì', hint: 'Thành viên vào phòng khi chủ trì chưa vào' },
  { key: 'chatEnabled', label: 'Chat', hint: 'Nhắn tin chung trong phòng' },
  { key: 'screenShareEnabled', label: 'Chia sẻ màn hình', hint: '' },
  { key: 'whiteboardEnabled', label: 'Bảng trắng', hint: '' },
  { key: 'fileUploadEnabled', label: 'Tải tài liệu lên trong phòng', hint: '' },
  { key: 'recordingEnabled', label: 'Ghi hình', hint: 'Cần quyền MEETING_RECORD' },
  { key: 'captionsEnabled', label: 'Phụ đề', hint: 'Nhận dạng giọng nói tiếng Việt' },
  { key: 'aiMinutesEnabled', label: 'Biên bản AI', hint: 'Tự tạo bản nháp biên bản sau họp (P13)' },
];

const TIME_ZONES = [
  { value: 'Asia/Bangkok', label: '(GMT+07:00) Hà Nội, Bangkok' },
  { value: 'Asia/Tokyo', label: '(GMT+09:00) Tokyo, Seoul' },
  { value: 'Asia/Singapore', label: '(GMT+08:00) Singapore' },
  { value: 'Europe/London', label: '(GMT+00:00) London' },
];

/**
 * Drawer tạo / sửa cuộc họp (Scope P9). Giờ nhập theo giờ máy, gửi lên BE dạng UTC.
 * Sửa cuộc họp đang diễn ra: chỉ sửa mô tả và thêm người. Cảnh báo trùng lịch chỉ để biết, không chặn lưu.
 */
@Component({
  selector: 'app-meeting-form',
  standalone: true,
  imports: [SharedModules],
  templateUrl: './meeting-form.html',
  styleUrl: './meeting-form.scss',
})
export class MeetingForm implements OnInit, OnChanges, OnDestroy {
  @Input() visible = false;
  /** null = tạo mới. */
  @Input() meetingId: string | null = null;
  /** Ngày giờ gợi ý khi tạo mới (VD bấm ô lịch ở P11). */
  @Input() presetStart: Date | null = null;
  /** Người được mời điền sẵn khi tạo mới (VD bấm "Mời họp" ở Danh bạ P15). */
  @Input() presetParticipants: UserSearchItem[] = [];
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() saved = new EventEmitter<MeetingDetail>();

  private destroy$ = new Subject<void>();
  private conflict$ = new Subject<string>();
  readonly search$ = new Subject<string>();

  readonly roleOptions = MEETING_ASSIGNABLE_ROLES;
  readonly roleMeta = roleMeta;
  readonly visibilityOptions = MEETING_VISIBILITY_OPTIONS;
  readonly settingItems = SETTING_ITEMS;
  readonly timeZones = TIME_ZONES;

  tabIndex = 0;
  isLoading = false;
  isSaving = false;
  submitted = false;
  original: MeetingDetail | null = null;

  name = '';
  description = '';
  agenda = '';
  date: Date | null = null;
  startTime: Date | null = null;
  endTime: Date | null = null;
  timeZone = 'Asia/Bangkok';
  visibility: MeetingVisibility = MeetingVisibility.InvitedOnly;
  settings: MeetingSettings = defaultMeetingSettings();
  participants: ParticipantRow[] = [];

  searchOptions: UserSearchItem[] = [];
  searching = false;
  pickedUser: string | null = null;
  conflicts: ScheduleConflict[] = [];

  private me = '';

  constructor(private service: MeetingService, private session: SessionService) { }

  ngOnInit(): void {
    this.me = (this.session.accountInfo?.userName ?? '').toLowerCase();

    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => {
        this.searching = true;
        return this.service.searchUsers(q.trim(), 10).pipe(finalize(() => this.searching = false));
      }),
      takeUntil(this.destroy$),
    ).subscribe(list => {
      const taken = new Set(this.participants.map(p => p.userName.toLowerCase()));
      this.searchOptions = (list ?? []).filter(u => !taken.has(u.userName.toLowerCase()));
    });

    // Gom các lần đổi giờ / thêm người rồi mới hỏi BE.
    this.conflict$.pipe(
      debounceTime(500),
      distinctUntilChanged(),
      switchMap(() => this.checkConflicts()),
      takeUntil(this.destroy$),
    ).subscribe(list => this.conflicts = list);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible']?.currentValue) {
      this.open();
    }
  }

  // ===================== Trạng thái form =====================

  get isEdit(): boolean {
    return !!this.meetingId;
  }

  get isDraft(): boolean {
    return !this.isEdit || this.original?.status === MeetingStatus.Draft;
  }

  /** Đang họp: chỉ sửa mô tả và thêm người. */
  get isOngoing(): boolean {
    return this.original?.status === MeetingStatus.Ongoing;
  }

  get title(): string {
    if (!this.isEdit) return 'TẠO CUỘC HỌP';
    return this.isOngoing ? 'SỬA CUỘC HỌP ĐANG DIỄN RA' : 'SỬA CUỘC HỌP';
  }

  get start(): Date | null {
    return this.combine(this.date, this.startTime);
  }

  get end(): Date | null {
    return this.combine(this.date, this.endTime);
  }

  get nameError(): string {
    if (!this.submitted) return '';
    return this.name.trim() ? '' : 'Vui lòng nhập tên cuộc họp';
  }

  get timeError(): string {
    if (!this.submitted && !(this.startTime && this.endTime)) return '';
    const start = this.start;
    const end = this.end;
    if (!start || !end) return this.submitted ? 'Vui lòng chọn ngày, giờ bắt đầu và giờ kết thúc' : '';
    if (end <= start) return 'Giờ kết thúc phải sau giờ bắt đầu';
    // Chỉ chặn giờ quá khứ khi tạo mới / đổi giờ (cho lệch 5 phút để kịp thao tác).
    if (!this.isOngoing && this.timeChanged && start.getTime() < Date.now() - 5 * 60_000) return 'Giờ bắt đầu đã qua';
    return '';
  }

  get durationText(): string {
    const start = this.start;
    const end = this.end;
    if (!start || !end || end <= start) return '';
    const minutes = Math.round((end.getTime() - start.getTime()) / 60_000);
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return h ? `${h} giờ${m ? ' ' + m + ' phút' : ''}` : `${m} phút`;
  }

  private get timeChanged(): boolean {
    if (!this.original) return true;
    // So theo phút: giờ đã lưu có thể kèm giây, còn time-picker chỉ chọn tới phút.
    const minute = (d: Date | null | undefined) => d ? Math.floor(d.getTime() / 60_000) : null;
    return minute(this.start) !== minute(DateTimeUtils.fromUtc(this.original.expectedStartTime))
      || minute(this.end) !== minute(DateTimeUtils.fromUtc(this.original.expectedEndTime));
  }

  /** Tên các tab có lỗi → tô đỏ tiêu đề tab. */
  get infoTabInvalid(): boolean {
    return !!(this.nameError || this.timeError);
  }

  // ===================== Mở drawer =====================

  private open(): void {
    this.tabIndex = 0;
    this.submitted = false;
    this.conflicts = [];
    this.searchOptions = [];
    this.pickedUser = null;
    this.original = null;
    if (this.meetingId) {
      this.isLoading = true;
      this.service.detail(this.meetingId, false)
        .pipe(finalize(() => this.isLoading = false), takeUntil(this.destroy$))
        .subscribe(detail => this.fill(detail));
    } else {
      this.resetForCreate();
    }
  }

  private resetForCreate(): void {
    const start = this.presetStart ? new Date(this.presetStart) : this.nextSlot();
    const end = new Date(start.getTime() + 60 * 60_000);
    this.name = '';
    this.description = '';
    this.agenda = '';
    this.date = DateTimeUtils.startOfDay(start);
    this.startTime = start;
    this.endTime = end;
    this.timeZone = 'Asia/Bangkok';
    this.visibility = MeetingVisibility.InvitedOnly;
    this.settings = defaultMeetingSettings();
    const account = this.session.accountInfo;
    this.participants = [{
      userName: account?.userName ?? '',
      fullName: account?.fullName ?? account?.userName ?? '',
      email: account?.email ?? '',
      role: MeetingRole.Host,
      existing: false,
      isMe: true,
    }];
    for (const u of this.presetParticipants ?? []) {
      if (u.userName.toLowerCase() !== this.me && !this.participants.some(p => p.userName.toLowerCase() === u.userName.toLowerCase())) {
        this.participants.push({ userName: u.userName, fullName: u.fullName, email: u.email, role: MeetingRole.Required, existing: false, isMe: false });
      }
    }
    this.queueConflictCheck();
  }

  private fill(d: MeetingDetail): void {
    this.original = d;
    const start = DateTimeUtils.fromUtc(d.expectedStartTime);
    const end = DateTimeUtils.fromUtc(d.expectedEndTime);
    this.name = d.name ?? '';
    this.description = d.description ?? '';
    this.agenda = d.agenda ?? '';
    this.date = start ? DateTimeUtils.startOfDay(start) : null;
    this.startTime = start;
    this.endTime = end;
    this.timeZone = d.timeZone || 'Asia/Bangkok';
    this.visibility = d.visibility as MeetingVisibility;
    this.settings = { ...defaultMeetingSettings(), ...(d.settings ?? {}) };
    this.participants = (d.participants ?? []).map(p => ({
      userName: p.userName,
      fullName: p.fullName,
      email: p.email,
      role: p.role,
      existing: true,
      isMe: p.userName.toLowerCase() === this.me,
    })).sort((a, b) => a.role - b.role);
    this.queueConflictCheck();
  }

  /** Mốc tròn 30 phút kế tiếp. */
  private nextSlot(): Date {
    const d = new Date();
    d.setSeconds(0, 0);
    d.setMinutes(d.getMinutes() < 30 ? 30 : 60);
    return d;
  }

  private combine(date: Date | null, time: Date | null): Date | null {
    if (!date || !time) return null;
    const d = new Date(date);
    d.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return d;
  }

  // ===================== Thời gian =====================

  onStartChange(value: Date | null): void {
    // Giữ nguyên thời lượng khi dời giờ bắt đầu.
    const prevStart = this.combine(this.date, this.startTime);
    const prevEnd = this.combine(this.date, this.endTime);
    this.startTime = value;
    if (value && prevStart && prevEnd && prevEnd > prevStart) {
      this.endTime = new Date(value.getTime() + (prevEnd.getTime() - prevStart.getTime()));
    }
    this.queueConflictCheck();
  }

  setDuration(minutes: number): void {
    if (!this.startTime || this.isOngoing) return;
    this.endTime = new Date(this.startTime.getTime() + minutes * 60_000);
    this.queueConflictCheck();
  }

  queueConflictCheck(): void {
    const start = this.start;
    const end = this.end;
    const key = start && end ? `${start.getTime()}|${end.getTime()}|${this.participants.map(p => p.userName).join(',')}` : '';
    this.conflict$.next(key);
  }

  private checkConflicts(): Observable<ScheduleConflict[]> {
    const start = this.start;
    const end = this.end;
    if (!start || !end || end <= start) return of([]);
    return this.service.conflicts(
      DateTimeUtils.toUtc(start), DateTimeUtils.toUtc(end), this.participants.map(p => p.userName), this.meetingId,
    );
  }

  get conflictGroups(): { meetingId: string; meetingName: string; start: Date | null; end: Date | null; people: string[] }[] {
    const map = new Map<string, { meetingId: string; meetingName: string; start: Date | null; end: Date | null; people: string[] }>();
    for (const c of this.conflicts) {
      const g = map.get(c.meetingId) ?? {
        meetingId: c.meetingId, meetingName: c.meetingName,
        start: DateTimeUtils.fromUtc(c.expectedStartTime), end: DateTimeUtils.fromUtc(c.expectedEndTime), people: [],
      };
      g.people.push(c.userName.toLowerCase() === this.me ? 'Bạn' : c.fullName || c.userName);
      map.set(c.meetingId, g);
    }
    return [...map.values()];
  }

  // ===================== Thành phần =====================

  addPicked(userName: string | null): void {
    if (!userName) return;
    const user = this.searchOptions.find(u => u.userName === userName);
    if (user && !this.participants.some(p => p.userName.toLowerCase() === user.userName.toLowerCase())) {
      this.participants = [...this.participants, {
        userName: user.userName, fullName: user.fullName, email: user.email,
        role: MeetingRole.Required, existing: false, isMe: false,
      }];
      this.queueConflictCheck();
    }
    // Xóa lựa chọn sau khi thêm để chọn tiếp người khác.
    setTimeout(() => this.pickedUser = null);
    this.searchOptions = this.searchOptions.filter(u => u.userName !== userName);
  }

  removeParticipant(row: ParticipantRow): void {
    if (row.isMe) return;
    this.participants = this.participants.filter(p => p !== row);
    this.queueConflictCheck();
  }

  canRemove(row: ParticipantRow): boolean {
    // Đang họp: không mời ra ở đây (làm trong phòng họp, P10).
    return !row.isMe && !(this.isOngoing && row.existing);
  }

  get coHostCount(): number {
    return this.participants.filter(p => p.role === MeetingRole.CoHost).length;
  }

  // ===================== Lưu =====================

  /** draft: Lưu nháp. publish: bản nháp → phát hành và gửi lời mời. */
  save(mode: 'draft' | 'publish' | 'update'): void {
    this.submitted = true;
    if (this.nameError || this.timeError) {
      this.tabIndex = 0;
      return;
    }
    if (this.isSaving) return;
    this.isSaving = true;
    const request$ = this.isEdit ? this.saveEdit(mode === 'publish') : this.saveCreate(mode === 'draft');
    request$
      .pipe(finalize(() => this.isSaving = false), takeUntil(this.destroy$))
      .subscribe(detail => {
        this.saved.emit(detail);
        this.visibleChange.emit(false);
      });
  }

  private saveCreate(asDraft: boolean): Observable<MeetingDetail> {
    return this.service.create({
      name: this.name.trim(),
      description: this.description.trim(),
      agenda: this.agenda.trim(),
      expectedStartTime: DateTimeUtils.toUtc(this.start!),
      expectedEndTime: DateTimeUtils.toUtc(this.end!),
      timeZone: this.timeZone,
      visibility: this.visibility,
      saveAsDraft: asDraft,
      publishInvitation: !asDraft,
      settings: this.settings,
      participants: this.participants.filter(p => !p.isMe).map(p => ({ userName: p.userName, role: p.role })),
    });
  }

  /** PATCH thông tin → thêm người mới → xóa người bị bỏ. Trả về chi tiết sau cùng. */
  private saveEdit(publish: boolean): Observable<MeetingDetail> {
    const o = this.original!;
    const id = o.id;
    // Không đổi giờ → không gửi giờ (BE giữ nguyên, tránh báo "dời lịch" vì lệch phần giây).
    const keepTime = this.isOngoing || !this.timeChanged;
    const update$ = this.service.update(id, {
      id,
      name: this.isOngoing ? o.name : this.name.trim(),
      description: this.description.trim(),
      agenda: this.isOngoing ? o.agenda : this.agenda.trim(),
      expectedStartTime: keepTime ? null : DateTimeUtils.toUtc(this.start!),
      expectedEndTime: keepTime ? null : DateTimeUtils.toUtc(this.end!),
      timeZone: this.timeZone,
      visibility: this.isOngoing ? o.visibility as MeetingVisibility : this.visibility,
      settings: this.settings,
      rowVersion: o.rowVersion || null,
      publish,
    });

    const before = new Set((o.participants ?? []).map(p => p.userName.toLowerCase()));
    const now = new Set(this.participants.map(p => p.userName.toLowerCase()));
    const added = this.participants.filter(p => !before.has(p.userName.toLowerCase()))
      .map(p => ({ userName: p.userName, role: p.role }));
    const removed = (o.participants ?? []).filter(p => !now.has(p.userName.toLowerCase())).map(p => p.userName);

    const steps: Observable<MeetingDetail | null>[] = [update$];
    if (added.length) steps.push(this.service.addParticipants(id, added));
    removed.forEach(u => steps.push(this.service.removeParticipant(id, u).pipe(map(() => null))));
    // Lấy lại chi tiết sau cùng để danh sách người tham gia chính xác.
    if (removed.length) steps.push(this.service.detail(id, false));

    return concat(...steps).pipe(
      toArray(),
      map(results => results.filter((r): r is MeetingDetail => !!r).pop()!),
    );
  }

  close(): void {
    if (this.isSaving) return;
    this.visibleChange.emit(false);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}

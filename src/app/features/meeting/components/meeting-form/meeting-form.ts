import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { Observable, Subject, concat, debounceTime, distinctUntilChanged, finalize, map, of, switchMap, takeUntil, toArray } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTreeNodeOptions } from 'ng-zorro-antd/tree';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { ContactsService } from '../../../contacts/services/contacts.service';
import { OrganizationService } from '../../../admin/services/organization.service';
import { OrganizationNode } from '../../../admin/models/admin.models';
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
  { key: 'aiMinutesEnabled', label: 'Biên bản AI', hint: 'Tự tạo bản nháp biên bản sau họp (P13)' },
];

/** Múi giờ cố định của hệ thống — không cho người dùng chọn. */
const SYSTEM_TIME_ZONE = 'Asia/Bangkok';

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

  tabIndex = 0;
  isLoading = false;
  isSaving = false;
  submitted = false;
  original: MeetingDetail | null = null;

  name = '';
  description = '';
  agenda = '';
  startAt: Date | null = null;
  endAt: Date | null = null;
  visibility: MeetingVisibility = MeetingVisibility.InvitedOnly;
  settings: MeetingSettings = defaultMeetingSettings();
  participants: ParticipantRow[] = [];

  searchOptions: UserSearchItem[] = [];
  searching = false;
  pickedUser: string | null = null;
  conflicts: ScheduleConflict[] = [];

  private me = '';

  orgTree: NzTreeNodeOptions[] = [];
  private orgs: OrganizationNode[] = [];
  pickedOrg: string | null = null;
  addingOrg = false;

  constructor(
    private service: MeetingService,
    private session: SessionService,
    private contacts: ContactsService,
    private orgService: OrganizationService,
    private message: NzMessageService,
  ) { }

  ngOnInit(): void {
    this.me = (this.session.accountInfo?.userName ?? '').toLowerCase();

    this.orgService.tree(false).pipe(takeUntil(this.destroy$)).subscribe(list => {
      this.orgs = (list ?? []).filter(o => o.isActive);
      this.orgTree = OrganizationService.toNzTree(this.orgs, { expandAll: true, selectableInactive: false });
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
    return this.startAt;
  }

  get end(): Date | null {
    return this.endAt;
  }

  get nameError(): string {
    if (!this.submitted) return '';
    return this.name.trim() ? '' : 'Vui lòng nhập tên cuộc họp';
  }

  get timeError(): string {
    if (!this.submitted && !(this.startAt && this.endAt)) return '';
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
    this.startAt = start;
    this.endAt = end;
    this.visibility = MeetingVisibility.InvitedOnly;
    this.settings = this.normalizeSettings(defaultMeetingSettings());
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
    this.startAt = start;
    this.endAt = end;
    // Chỉ còn Nội bộ (chỉ người được mời) và Công khai; giá trị cũ "Nội bộ theo mã" (1) coi như Nội bộ.
    this.visibility = d.visibility === MeetingVisibility.Public ? MeetingVisibility.Public : MeetingVisibility.InvitedOnly;
    this.settings = this.normalizeSettings({ ...defaultMeetingSettings(), ...(d.settings ?? {}) });
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

  /** Chat, chia sẻ màn hình, bảng trắng, tải tài liệu, ghi hình, transcript luôn có sẵn trong phòng họp. */
  private normalizeSettings(s: MeetingSettings): MeetingSettings {
    return {
      ...s, chatEnabled: true, screenShareEnabled: true, whiteboardEnabled: true,
      fileUploadEnabled: true, recordingEnabled: true, captionsEnabled: true,
    };
  }

  // ===================== Thời gian =====================

  onStartChange(value: Date | null): void {
    // Giữ nguyên thời lượng khi dời giờ bắt đầu.
    const prevStart = this.startAt;
    const prevEnd = this.endAt;
    this.startAt = value;
    if (value && prevStart && prevEnd && prevEnd > prevStart) {
      this.endAt = new Date(value.getTime() + (prevEnd.getTime() - prevStart.getTime()));
    }
    this.queueConflictCheck();
  }

  setDuration(minutes: number): void {
    if (!this.startAt || this.isOngoing) return;
    this.endAt = new Date(this.startAt.getTime() + minutes * 60_000);
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

  /** Mời cả phòng ban (gồm phòng ban con): thêm từng nhân sự chưa có trong danh sách với vai trò Bắt buộc. */
  addOrg(orgId: string | null): void {
    if (!orgId || this.addingOrg) return;
    const orgName = this.orgs.find(o => o.id === orgId)?.name ?? 'phòng ban';
    this.addingOrg = true;
    const loadPage = (page: number, acc: UserSearchItem[]): Observable<UserSearchItem[]> =>
      this.contacts.search(orgId, '', page, 100).pipe(
        switchMap(res => {
          const all = [...acc, ...(res?.items ?? []).map(c => ({ userName: c.userName, fullName: c.fullName, email: c.email ?? '' }))];
          return page < (res?.totalPages ?? 1) ? loadPage(page + 1, all) : of(all);
        }),
      );
    loadPage(1, []).pipe(finalize(() => { this.addingOrg = false; setTimeout(() => this.pickedOrg = null); }), takeUntil(this.destroy$))
      .subscribe({
        next: users => {
          const taken = new Set(this.participants.map(p => p.userName.toLowerCase()));
          const fresh = users.filter(u => u.userName && !taken.has(u.userName.toLowerCase()));
          if (fresh.length) {
            this.participants = [...this.participants, ...fresh.map(u => ({
              userName: u.userName, fullName: u.fullName, email: u.email,
              role: MeetingRole.Required, existing: false, isMe: false,
            }))];
            this.queueConflictCheck();
          }
          this.message.success(fresh.length
            ? `Đã mời ${fresh.length} người từ "${orgName}"`
            : `Mọi nhân sự của "${orgName}" đã có trong danh sách (hoặc phòng ban chưa có nhân sự)`);
        },
        error: () => this.message.error('Không lấy được danh sách nhân sự của phòng ban'),
      });
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
      timeZone: SYSTEM_TIME_ZONE,
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
      timeZone: SYSTEM_TIME_ZONE,
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

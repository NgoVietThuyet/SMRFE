import { Component, ElementRef, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, filter, finalize, interval, takeUntil } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { GlobalService } from '../../../../core';
import { RealtimeHubService } from '../../../../shared/services';
import { DateTimeUtils, StringUtils } from '../../../../shared/utils';
import { MeetingService } from '../../../meeting/services/meeting.service';
import { MeetingFile } from '../../../meeting/models/meeting.models';
import {
  JobStatus, MINUTES_STATUS_META, MinutesActionItem, MinutesContent, MinutesDecision, MinutesDetail, MinutesStatus,
  MinutesVersion, TranscriptSegment,
} from '../../models/minutes.models';
import { MinutesService, offsetLabel, saveBlob } from '../../services/minutes.service';
import { formatRange } from '../minutes-list/minutes-list';
import { MinutesExportActions } from '../minutes-export-actions/minutes-export-actions';

/** Mục đang chọn nguồn: bấm đoạn transcript bên trái để gắn vào mục này. */
type PickTarget = { kind: 'summary' } | { kind: 'decision'; index: number } | { kind: 'action'; index: number };

/**
 * P13 — Trình soạn biên bản `/minutes/:meetingId`.
 * Trái 40%: transcript (tìm, sửa, gán người nói). Phải 60%: Tóm tắt · Quyết định · Việc cần làm, mỗi mục có chip ⏱ nguồn.
 * Quy trình: Nháp → Chờ duyệt → Đã duyệt → Đã phát hành (bất biến); chủ trì có thể Từ chối (kèm lý do).
 */
@Component({
  selector: 'app-minutes-editor',
  standalone: true,
  imports: [SharedModules, MinutesExportActions],
  templateUrl: './minutes-editor.html',
  styleUrl: './minutes-editor.scss',
})
export class MinutesEditor implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  private stopPolling$ = new Subject<void>();
  readonly Status = MinutesStatus;
  readonly JobStatus = JobStatus;
  readonly statusMeta = MINUTES_STATUS_META;

  meetingId = '';
  detail: MinutesDetail | null = null;
  loadError: number | null = null;
  segments: TranscriptSegment[] = [];
  segmentById = new Map<string, TranscriptSegment>();
  transcriptKeyword = '';
  activeSegmentId: string | null = null;
  recordings: { file: MeetingFile; url: string | null }[] = [];

  /** Bản đang chỉnh (copy của detail.current.content). */
  draft: MinutesContent | null = null;
  dirty = false;
  saving = false;
  generating = false;
  pick: PickTarget | null = null;

  // Sửa transcript
  editingSegmentId: string | null = null;
  editText = '';
  editSpeaker = '';

  // Từ chối
  rejectVisible = false;
  rejectReason = '';

  private start: Date | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private global: GlobalService,
    private service: MinutesService,
    private meetingService: MeetingService,
    private hub: RealtimeHubService,
    private message: NzMessageService,
    private modal: NzModalService,
    private host: ElementRef<HTMLElement>,
  ) { }

  ngOnInit(): void {
    this.meetingId = this.route.snapshot.paramMap.get('meetingId') ?? '';
    this.global.setBreadcrumb([{ name: 'Biên bản họp', path: 'minutes' }]);
    this.load();
    this.loadTranscript();
    this.loadRecordings();
    this.hub.roomEvent.pipe(
      filter(e => e.name === 'MinutesStatusChanged' && e.payload?.meetingId === this.meetingId),
      takeUntil(this.destroy$),
    ).subscribe(e => this.onStatusEvent(e.payload));
  }

  ngOnDestroy(): void {
    this.global.setBreadcrumb([]);
    this.stopPolling$.next();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===================== Tải dữ liệu =====================

  load(version?: number | null): void {
    this.service.detail(this.meetingId, version).pipe(takeUntil(this.destroy$)).subscribe({
      next: d => this.apply(d),
      error: err => this.loadError = err?.status === 403 ? 403 : 404,
    });
  }

  private apply(d: MinutesDetail): void {
    this.detail = d;
    this.loadError = null;
    this.start = DateTimeUtils.fromUtc(d.startTime);
    this.global.setBreadcrumb([{ name: 'Biên bản họp', path: 'minutes' }, { name: d.meetingName, path: `minutes/${d.meetingId}` }]);
    this.draft = d.current ? structuredClone(d.current.content) : null;
    this.dirty = false;
    this.pick = null;
    const running = d.job && (d.job.status === JobStatus.Pending || d.job.status === JobStatus.Running);
    this.generating = !!running;
    if (running) this.startPolling(); else this.stopPolling$.next();
  }

  loadTranscript(): void {
    this.service.transcripts(this.meetingId).pipe(takeUntil(this.destroy$)).subscribe(list => {
      this.segments = list ?? [];
      this.segmentById = new Map(this.segments.map(s => [s.id, s]));
    });
  }

  private loadRecordings(): void {
    this.meetingService.files(this.meetingId).pipe(takeUntil(this.destroy$)).subscribe({
      next: files => {
        this.recordings = (files ?? []).filter(f => f.type === 2 || f.mimeType?.startsWith('video/'))
          .map(file => ({ file, url: null }));
        this.recordings.forEach(r => this.meetingService.downloadUrl(r.file.id).subscribe(res => r.url = res?.url ?? null));
      },
      error: () => this.recordings = [],
    });
  }

  /** Dự phòng khi mất realtime: hỏi lại mỗi 4 giây trong lúc AI đang soạn. */
  private startPolling(): void {
    this.stopPolling$.next();
    interval(4000).pipe(takeUntil(this.stopPolling$), takeUntil(this.destroy$)).subscribe(() => {
      this.service.detail(this.meetingId).subscribe(d => {
        const done = !d.job || d.job.status === JobStatus.Done || d.job.status === JobStatus.Failed;
        if (done) {
          this.stopPolling$.next();
          this.afterJob(d);
        }
      });
    });
  }

  private onStatusEvent(payload: { state: string; version?: number }): void {
    if (payload.state === 'running') return;
    if (this.dirty) {
      // Không ghi đè nội dung đang sửa; chỉ cập nhật danh sách phiên bản / job.
      this.service.detail(this.meetingId, this.detail?.current?.version).subscribe(d => {
        if (this.detail) {
          this.detail = { ...d, current: this.detail.current };
          this.generating = !!d.job && (d.job.status === JobStatus.Pending || d.job.status === JobStatus.Running);
        }
      });
      return;
    }
    this.service.detail(this.meetingId).subscribe(d => this.afterJob(d));
  }

  private afterJob(d: MinutesDetail): void {
    const wasGenerating = this.generating;
    this.apply(d);
    if (wasGenerating && d.job?.status === JobStatus.Done) this.message.success('AI đã soạn xong bản nháp biên bản.');
    if (wasGenerating && d.job?.status === JobStatus.Failed) this.message.error(d.job.error || 'Sinh biên bản thất bại.');
  }

  // ===================== Thông tin hiển thị =====================

  get current(): MinutesVersion | null {
    return this.detail?.current ?? null;
  }

  get editable(): boolean {
    const c = this.current;
    return !!this.detail?.canEdit && !!c && (c.status === MinutesStatus.Draft || c.status === MinutesStatus.Rejected);
  }

  get when(): string {
    return this.detail ? formatRange(this.detail.startTime, this.detail.endTime) : '';
  }

  get filteredSegments(): TranscriptSegment[] {
    const k = StringUtils.normalizeSearch(this.transcriptKeyword);
    if (!k) return this.segments;
    return this.segments.filter(s => StringUtils.normalizeSearch(`${s.speakerName ?? ''} ${s.text}`).includes(k));
  }

  /** Cảnh báo tính trên bản đang sửa (BE tính lại khi lưu). */
  get liveWarnings(): string[] {
    if (!this.draft) return [];
    const w: string[] = [];
    this.draft.decisions.forEach((d, i) => { if (!d.sources.length) w.push(`Quyết định ${i + 1} chưa có đoạn transcript nguồn`); });
    this.draft.actions.forEach((a, i) => { if (!a.sources.length) w.push(`Việc cần làm ${i + 1} chưa có đoạn transcript nguồn`); });
    return w;
  }

  offset(seg: TranscriptSegment | undefined): string {
    if (!seg) return '??:??';
    return offsetLabel(this.start ?? DateTimeUtils.fromUtc(this.segments[0]?.timestamp), DateTimeUtils.fromUtc(seg.timestamp));
  }

  chipLabel(id: string): string {
    const seg = this.segmentById.get(id);
    return seg ? `⏱ ${this.offset(seg)}` : '⏱ ?';
  }

  chipTooltip(id: string): string {
    const seg = this.segmentById.get(id);
    return seg ? `${seg.speakerName || 'Người tham gia'}: ${seg.text}` : 'Đoạn transcript không còn tồn tại';
  }

  versionLabel(v: { version: number; status: MinutesStatus; source: string }): string {
    return `Phiên bản ${v.version} · ${this.statusMeta[v.status].label}${v.source === 'AI' ? ' · AI' : ''}`;
  }

  timeOf(utc: string | null | undefined): string {
    const d = DateTimeUtils.fromUtc(utc);
    if (!d) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  // ===================== Nguồn (chip ⏱) =====================

  jumpTo(segmentId: string): void {
    this.activeSegmentId = segmentId;
    if (this.transcriptKeyword) this.transcriptKeyword = '';
    setTimeout(() => {
      const el = this.host.nativeElement.querySelector(`[data-seg="${CSS.escape(segmentId)}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  startPick(target: PickTarget): void {
    this.pick = this.isPicking(target) ? null : target;
  }

  isPicking(target: PickTarget): boolean {
    const p = this.pick;
    if (!p || p.kind !== target.kind) return false;
    return p.kind === 'summary' || (p as { index: number }).index === (target as { index: number }).index;
  }

  onSegmentClick(seg: TranscriptSegment): void {
    this.activeSegmentId = seg.id;
    if (!this.pick || !this.draft) return;
    const list = this.sourcesOf(this.pick);
    if (!list.includes(seg.id)) {
      list.push(seg.id);
      list.sort((a, b) => this.segments.findIndex(s => s.id === a) - this.segments.findIndex(s => s.id === b));
      this.dirty = true;
    }
  }

  removeSource(target: PickTarget, id: string): void {
    const list = this.sourcesOf(target);
    const i = list.indexOf(id);
    if (i >= 0) {
      list.splice(i, 1);
      this.dirty = true;
    }
  }

  private sourcesOf(t: PickTarget): string[] {
    const d = this.draft!;
    if (t.kind === 'summary') return d.summarySources;
    return t.kind === 'decision' ? d.decisions[t.index].sources : d.actions[t.index].sources;
  }

  summaryTarget: PickTarget = { kind: 'summary' };
  decisionTarget(index: number): PickTarget { return { kind: 'decision', index }; }
  actionTarget(index: number): PickTarget { return { kind: 'action', index }; }

  // ===================== Sửa nội dung =====================

  markDirty(): void {
    this.dirty = true;
  }

  addDecision(): void {
    this.draft?.decisions.push({ id: null, text: '', sources: [] } as MinutesDecision);
    this.dirty = true;
  }

  removeDecision(i: number): void {
    this.draft?.decisions.splice(i, 1);
    this.pick = null;
    this.dirty = true;
  }

  addAction(): void {
    this.draft?.actions.push({
      id: null, text: '', assignee: null, assigneeName: null, dueDate: null, sources: [], confirmed: true, taskId: null,
    } as MinutesActionItem);
    this.dirty = true;
  }

  removeAction(i: number): void {
    this.draft?.actions.splice(i, 1);
    this.pick = null;
    this.dirty = true;
  }

  onAssigneeChange(a: MinutesActionItem, userName: string | null): void {
    a.assignee = userName;
    a.assigneeName = this.detail?.participants.find(p => p.userName === userName)?.fullName ?? null;
    this.dirty = true;
  }

  dueAsDate(a: MinutesActionItem): Date | null {
    if (!a.dueDate) return null;
    const [y, m, d] = a.dueDate.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  onDueChange(a: MinutesActionItem, date: Date | null): void {
    const pad = (n: number) => String(n).padStart(2, '0');
    a.dueDate = date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : null;
    this.dirty = true;
  }

  trackByIndex = (i: number) => i;
  trackBySeg = (_: number, s: TranscriptSegment) => s.id;

  // ===================== Transcript =====================

  editSegment(seg: TranscriptSegment, event: Event): void {
    event.stopPropagation();
    this.editingSegmentId = seg.id;
    this.editText = seg.text;
    this.editSpeaker = seg.speakerName ?? '';
  }

  saveSegment(seg: TranscriptSegment): void {
    const text = this.editText.trim();
    if (!text) {
      this.message.warning('Nội dung đoạn không được để trống.');
      return;
    }
    this.service.updateSegment(this.meetingId, seg.id, text, this.editSpeaker.trim() || null).subscribe(updated => {
      Object.assign(seg, updated);
      this.editingSegmentId = null;
      this.message.success('Đã lưu đoạn transcript.');
    });
  }

  // ===================== Quy trình =====================

  generate(): void {
    const run = () => {
      this.generating = true;
      this.service.generate(this.meetingId).subscribe({
        next: job => {
          if (job.reused && job.status === JobStatus.Done) {
            this.generating = false;
            this.message.info('Transcript chưa thay đổi kể từ lần sinh trước — giữ bản AI đã có.');
            this.load();
            return;
          }
          this.message.info('AI đang soạn biên bản, bạn có thể tiếp tục làm việc khác.');
          if (this.detail) this.detail.job = job;
          this.startPolling();
        },
        error: () => this.generating = false,
      });
    };
    if (this.dirty) {
      this.modal.confirm({
        nzTitle: 'Bỏ thay đổi chưa lưu?',
        nzContent: 'AI sẽ tạo một phiên bản mới; nội dung bạn đang sửa chưa được lưu.',
        nzOkText: 'Vẫn sinh', nzCancelText: 'Quay lại', nzOnOk: run,
      });
    } else run();
  }

  save(after?: () => void): void {
    const c = this.current;
    if (!c || !this.draft) return;
    this.saving = true;
    this.service.update(this.meetingId, c.version, this.draft).pipe(finalize(() => this.saving = false)).subscribe(v => {
      this.replaceCurrent(v);
      if (after) after(); else this.message.success('Đã lưu bản nháp.');
    });
  }

  submit(): void {
    const c = this.current;
    if (!c) return;
    const go = () => this.service.transition(this.meetingId, c.version, 'submit').subscribe(v => {
      this.replaceCurrent(v);
      this.message.success('Đã gửi biên bản cho chủ trì duyệt.');
    });
    if (this.dirty) this.save(go); else go();
  }

  approve(): void {
    const c = this.current;
    if (!c) return;
    this.service.transition(this.meetingId, c.version, 'approve').subscribe(v => {
      this.replaceCurrent(v);
      this.message.success('Đã duyệt biên bản.');
    });
  }

  publish(): void {
    const c = this.current;
    if (!c) return;
    const tasks = c.content.actions.filter(a => a.confirmed && !a.taskId).length;
    this.modal.confirm({
      nzTitle: 'Phát hành biên bản?',
      nzContent: `Biên bản sẽ gửi tới mọi thành viên và không sửa được nữa.${tasks ? ` Hệ thống tạo ${tasks} công việc từ mục "Việc cần làm".` : ''}`,
      nzOkText: 'Phát hành', nzCancelText: 'Hủy',
      nzOnOk: () => this.service.transition(this.meetingId, c.version, 'publish').subscribe(v => {
        this.replaceCurrent(v);
        this.message.success('Đã phát hành biên bản.');
      }),
    });
  }

  openReject(): void {
    this.rejectReason = '';
    this.rejectVisible = true;
  }

  confirmReject(): void {
    const c = this.current;
    const reason = this.rejectReason.trim();
    if (!c || !reason) return;
    this.service.reject(this.meetingId, c.version, reason).subscribe(v => {
      this.rejectVisible = false;
      this.replaceCurrent(v);
      this.message.success('Đã trả biên bản về cho người soạn.');
    });
  }

  newDraft(): void {
    this.service.newDraft(this.meetingId).subscribe(v => {
      this.message.success(`Đã tạo phiên bản ${v.version} để chỉnh sửa.`);
      this.load(v.version);
    });
  }

  selectVersion(version: number): void {
    if (version === this.current?.version) return;
    const go = () => this.load(version);
    if (this.dirty) {
      this.modal.confirm({ nzTitle: 'Bỏ thay đổi chưa lưu?', nzOkText: 'Bỏ thay đổi', nzCancelText: 'Quay lại', nzOnOk: go });
    } else go();
  }

  download(): void {
    const c = this.current;
    if (!c) return;
    this.service.docx(this.meetingId, c.version).subscribe(({ blob, fileName }) => saveBlob(blob, fileName));
  }

  openTask(taskId: string): void {
    this.router.navigate(['/tasks'], { queryParams: { focus: taskId } });
  }

  back(): void {
    this.router.navigate(['/minutes']);
  }

  private replaceCurrent(v: MinutesVersion): void {
    if (!this.detail) return;
    this.detail.current = v;
    this.detail.versions = this.detail.versions.map(x => x.version === v.version ? { ...x, status: v.status } : x);
    this.draft = structuredClone(v.content);
    this.dirty = false;
    this.pick = null;
  }
}

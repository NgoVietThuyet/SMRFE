import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, finalize, takeUntil } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { GlobalService } from '../../../../core';
import { MarkdownPipe } from '../../../../shared/pipes/markdown.pipe';
import { MinutesListItem, MinutesStatus } from '../../../minutes/models/minutes.models';
import { MinutesService } from '../../../minutes/services/minutes.service';
import { formatRange } from '../../../minutes/components/minutes-list/minutes-list';
import { AiAssistantService, AiCitation, AiRagStatus } from '../../services/ai-assistant.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  citations: AiCitation[];
  /** Máy chủ AI lỗi → câu trả lời là trích đoạn. */
  degraded?: boolean;
}

const SUGGESTIONS = [
  'Tóm tắt nội dung chính của cuộc họp',
  'Cuộc họp đã thống nhất những quyết định gì?',
  'Ai được giao việc gì và hạn khi nào?',
];

/**
 * P14 — Trợ lý AI `/ai-assistant` (khung chat theo chat-bot của 2.FrontEnd, bỏ giọng nói / đính kèm / lịch sử máy chủ).
 * Trái: cuộc họp tôi tham gia đã/đang diễn ra. Phải: hỏi đáp trong phạm vi MỘT cuộc họp; câu trả lời markdown kèm trích dẫn
 * [Cuộc họp · ⏱ mm:ss]. Hội thoại giữ trong bộ nhớ theo từng cuộc họp cho tới khi rời trang.
 */
@Component({
  selector: 'app-ai-assistant',
  standalone: true,
  imports: [SharedModules, MarkdownPipe],
  templateUrl: './ai-assistant.html',
  styleUrl: './ai-assistant.scss',
})
export class AiAssistant implements OnInit, OnDestroy {
  @ViewChild('messageContainer') private messageContainer?: ElementRef<HTMLElement>;
  private destroy$ = new Subject<void>();
  private search$ = new Subject<void>();
  readonly suggestions = SUGGESTIONS;

  keyword = '';
  meetings: MinutesListItem[] = [];
  loadingMeetings = false;
  selected: MinutesListItem | null = null;
  status: AiRagStatus | null = null;
  syncing = false;

  private conversations = new Map<string, ChatMessage[]>();
  messages: ChatMessage[] = [];
  input = '';
  asking = false;

  constructor(
    private global: GlobalService,
    private minutes: MinutesService,
    private service: AiAssistantService,
    private route: ActivatedRoute,
    private router: Router,
    private message: NzMessageService,
  ) {
    this.global.setBreadcrumb([{ name: 'Trợ lý AI', path: 'ai-assistant' }]);
  }

  ngOnInit(): void {
    this.search$.pipe(debounceTime(300), takeUntil(this.destroy$)).subscribe(() => this.loadMeetings());
    this.loadMeetings(this.route.snapshot.queryParamMap.get('meetingId'));
  }

  ngOnDestroy(): void {
    this.global.setBreadcrumb([]);
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadMeetings(preselectId?: string | null): void {
    this.loadingMeetings = true;
    this.minutes.list(this.keyword.trim(), 1, 100)
      .pipe(finalize(() => this.loadingMeetings = false), takeUntil(this.destroy$))
      .subscribe(res => {
        this.meetings = res?.items ?? [];
        const pre = preselectId ? this.meetings.find(m => m.meetingId === preselectId) : null;
        if (pre) this.select(pre);
      });
  }

  onKeywordChange(): void {
    this.search$.next();
  }

  select(m: MinutesListItem): void {
    if (this.asking) return;
    this.selected = m;
    this.messages = this.conversations.get(m.meetingId) ?? [];
    this.conversations.set(m.meetingId, this.messages);
    this.status = null;
    this.router.navigate([], { relativeTo: this.route, queryParams: { meetingId: m.meetingId }, replaceUrl: true });
    this.service.status(m.meetingId).pipe(takeUntil(this.destroy$)).subscribe(s => {
      if (this.selected?.meetingId === m.meetingId) this.status = s;
    });
    this.scrollToBottom();
  }

  when(m: MinutesListItem): string {
    return formatRange(m.startTime, m.endTime);
  }

  hasPublishedMinutes(m: MinutesListItem): boolean {
    return m.minutesStatus === MinutesStatus.Published || !!m.publishedAt;
  }

  /** Cuộc họp chưa có transcript lẫn biên bản → AI chỉ biết thông tin chung. */
  get thinData(): boolean {
    return !!this.selected && this.selected.transcriptCount === 0 && !this.hasPublishedMinutes(this.selected);
  }

  send(text?: string): void {
    const query = (text ?? this.input).trim();
    const meeting = this.selected;
    if (!query || !meeting || this.asking) return;
    const thread = this.messages;
    thread.push({ role: 'user', content: query, citations: [] });
    this.input = '';
    this.asking = true;
    this.scrollToBottom();
    this.service.ask(meeting.meetingId, query).pipe(finalize(() => {
      this.asking = false;
      this.scrollToBottom();
    })).subscribe({
      next: res => thread.push({
        role: 'assistant', content: res.answer, citations: res.citations ?? [], degraded: !res.success,
      }),
      error: () => thread.push({
        role: 'assistant', content: 'Không gửi được câu hỏi. Hãy thử lại sau ít phút.', citations: [], degraded: true,
      }),
    });
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      this.send();
    }
  }

  clearChat(): void {
    if (!this.selected) return;
    this.messages = [];
    this.conversations.set(this.selected.meetingId, this.messages);
  }

  sync(): void {
    if (!this.selected) return;
    this.syncing = true;
    this.service.sync(this.selected.meetingId).pipe(finalize(() => this.syncing = false)).subscribe(s => {
      this.status = s;
      this.message.success('Đã đồng bộ lại dữ liệu cuộc họp cho AI.');
    });
  }

  citationLabel(c: AiCitation): string {
    const name = this.selected?.meetingName ?? 'Cuộc họp';
    return c.sourceType === 'TRANSCRIPT' && c.offset ? `${name} · ⏱ ${c.offset}` : `${name} · ${c.sourceTitle}`;
  }

  openCitation(c: AiCitation): void {
    if (this.selected) this.router.navigate(['/minutes', this.selected.meetingId]);
  }

  copy(text: string): void {
    navigator.clipboard?.writeText(text).then(() => this.message.success('Đã sao chép câu trả lời.'));
  }

  private scrollToBottom(): void {
    setTimeout(() => {
      const el = this.messageContainer?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  trackById = (_: number, m: MinutesListItem) => m.meetingId;
}

import { AfterViewInit, Component, ElementRef, HostListener, Input, OnChanges, OnDestroy, SimpleChanges, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, finalize, takeUntil } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { MarkdownPipe } from '../../../../shared/pipes/markdown.pipe';
import { MinutesDetail, MinutesStatus } from '../../../minutes/models/minutes.models';
import { MinutesService } from '../../../minutes/services/minutes.service';
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
 * Tab "Hỏi đáp AI" trong chi tiết cuộc họp: hỏi đáp trong phạm vi MỘT cuộc họp, câu trả lời markdown kèm trích dẫn
 * [Cuộc họp · ⏱ mm:ss]. Hội thoại giữ trong bộ nhớ cho tới khi rời trang.
 */
@Component({
  selector: 'app-meeting-ai-chat',
  standalone: true,
  imports: [SharedModules, MarkdownPipe],
  templateUrl: './meeting-ai-chat.html',
  styleUrl: './meeting-ai-chat.scss',
})
export class MeetingAiChat implements OnChanges, AfterViewInit, OnDestroy {
  @ViewChild('panel') private panel?: ElementRef<HTMLElement>;
  @ViewChild('messageContainer') private messageContainer?: ElementRef<HTMLElement>;
  @Input({ required: true }) meetingId = '';
  @Input() meetingName = '';

  private destroy$ = new Subject<void>();
  readonly suggestions = SUGGESTIONS;

  status: AiRagStatus | null = null;
  syncing = false;
  minutesDetail: MinutesDetail | null = null;

  messages: ChatMessage[] = [];
  input = '';
  asking = false;

  constructor(
    private minutes: MinutesService,
    private service: AiAssistantService,
    private router: Router,
    private message: NzMessageService,
  ) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['meetingId'] || !this.meetingId) return;
    const id = this.meetingId;
    this.messages = [];
    this.status = null;
    this.minutesDetail = null;
    this.service.status(id).pipe(takeUntil(this.destroy$)).subscribe(s => {
      if (this.meetingId === id) this.status = s;
    });
    this.minutes.detail(id).pipe(takeUntil(this.destroy$)).subscribe({
      next: d => { if (this.meetingId === id) this.minutesDetail = d; },
      error: () => { /* không có biên bản: bỏ qua */ },
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.fitHeight());
  }

  /** Khung chat lấp đầy phần màn hình còn lại dưới tab (không để khoảng trống phía dưới). */
  @HostListener('window:resize')
  fitHeight(): void {
    const el = this.panel?.nativeElement;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY;
    const h = Math.max(420, window.innerHeight - top - 16);
    el.style.height = `${h}px`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Chưa có transcript lẫn biên bản phát hành → AI chỉ biết thông tin chung. */
  get thinData(): boolean {
    const d = this.minutesDetail;
    if (!d) return false;
    const published = !!d.versions?.some(v => v.status === MinutesStatus.Published);
    return d.transcriptCount === 0 && !published;
  }

  send(text?: string): void {
    const query = (text ?? this.input).trim();
    if (!query || !this.meetingId || this.asking) return;
    const id = this.meetingId;
    const thread = this.messages;
    thread.push({ role: 'user', content: query, citations: [] });
    this.input = '';
    this.asking = true;
    this.scrollToBottom();
    this.service.ask(id, query).pipe(finalize(() => {
      this.asking = false;
      this.scrollToBottom();
    }), takeUntil(this.destroy$)).subscribe({
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
    this.messages = [];
  }

  sync(): void {
    this.syncing = true;
    this.service.sync(this.meetingId).pipe(finalize(() => this.syncing = false), takeUntil(this.destroy$)).subscribe(s => {
      this.status = s;
      this.message.success('Đã đồng bộ lại dữ liệu cuộc họp cho AI.');
    });
  }

  citationLabel(c: AiCitation): string {
    const name = this.meetingName || 'Cuộc họp';
    return c.sourceType === 'TRANSCRIPT' && c.offset ? `${name} · ⏱ ${c.offset}` : `${name} · ${c.sourceTitle}`;
  }

  openCitation(_: AiCitation): void {
    this.router.navigate(['/minutes', this.meetingId]);
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
}

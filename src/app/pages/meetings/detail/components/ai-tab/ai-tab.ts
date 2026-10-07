import { Component, ElementRef, inject, input, OnInit, signal, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { MeetingService } from '../../../../../core/services/meeting.service';
import {
    MeetingCaptionDto,
    MeetingRagChunkDto,
    MeetingRagStatus,
} from '../../../../../core/models/meeting.models';

export interface ChatMessageItem {
    sender: 'user' | 'ai';
    text: string;
    citations?: MeetingRagChunkDto[];
    time: Date;
    model?: string;
    isFallback?: boolean;
}

@Component({
    selector: 'app-ai-tab',
    templateUrl: './ai-tab.html',
    styleUrl: './ai-tab.scss',
    imports: [
        CommonModule,
        FormsModule,
        NzButtonModule,
        NzEmptyModule,
        NzIconModule,
        NzInputModule,
        NzSpinModule,
        NzTagModule,
        NzTooltipModule,
    ],
})
export class AiTab implements OnInit {
    readonly meetingId = input.required<string>();

    private readonly meetingService = inject(MeetingService);
    private readonly message = inject(NzMessageService);
    private readonly sanitizer = inject(DomSanitizer);

    @ViewChild('chatContainer') private chatContainer?: ElementRef<HTMLDivElement>;

    readonly ragStatus = signal<MeetingRagStatus | null>(null);
    readonly isSyncing = signal<boolean>(false);
    readonly isLoadingStatus = signal<boolean>(false);

    readonly chatQuery = signal<string>('');
    readonly isAsking = signal<boolean>(false);
    readonly messages = signal<ChatMessageItem[]>([]);

    readonly transcripts = signal<MeetingCaptionDto[]>([]);
    readonly isLoadingTranscripts = signal<boolean>(false);
    readonly activeSubTab = signal<'chat' | 'transcripts'>('chat');

    readonly promptSuggestions = [
        '📝 Tóm tắt nội dung chính và kết luận của cuộc họp',
        '👥 Ai là những người đã tham gia cuộc họp?',
        '📋 Có những nhiệm vụ hoặc công việc nào được giao?',
        '⏰ Có những mốc thời hạn (deadline) quan trọng nào?',
    ];

    ngOnInit(): void {
        this.loadRagStatus();
        this.loadTranscripts();
    }

    loadRagStatus(): void {
        this.isLoadingStatus.set(true);
        this.meetingService.getMeetingRagStatus(this.meetingId()).subscribe({
            next: (res) => {
                this.ragStatus.set(res);
                this.isLoadingStatus.set(false);
            },
            error: () => {
                this.isLoadingStatus.set(false);
            },
        });
    }

    syncRag(): void {
        this.isSyncing.set(true);
        this.meetingService.syncMeetingRag(this.meetingId()).subscribe({
            next: (res) => {
                this.ragStatus.set(res);
                this.isSyncing.set(false);
                this.message.success('Đồng bộ cơ sở tri thức RAG cuộc họp thành công!');
            },
            error: (err) => {
                this.isSyncing.set(false);
                this.message.error(err.message || 'Đồng bộ cơ sở tri thức thất bại.');
            },
        });
    }

    scrollToBottom(): void {
        setTimeout(() => {
            if (this.chatContainer?.nativeElement) {
                this.chatContainer.nativeElement.scrollTo({
                    top: this.chatContainer.nativeElement.scrollHeight,
                    behavior: 'smooth',
                });
            }
        }, 80);
    }

    formatMarkdown(raw: string): SafeHtml {
        if (!raw) return '';

        // 1. Escape HTML entities
        let escaped = raw
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');

        // 2. Code inline `code`
        escaped = escaped.replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');

        // 3. Bold **text** or __text__
        escaped = escaped.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
        escaped = escaped.replace(/__([^_]+)__/g, '<strong>$1</strong>');

        // 4. Italic *text* or _text_
        escaped = escaped.replace(/\*([^*]+)\*/g, '<em>$1</em>');

        // 5. Headers: ### Header
        escaped = escaped.replace(/^### (.*$)/gim, '<h4 class="ai-chat-h4">$1</h4>');
        escaped = escaped.replace(/^## (.*$)/gim, '<h3 class="ai-chat-h3">$1</h3>');
        escaped = escaped.replace(/^# (.*$)/gim, '<h2 class="ai-chat-h2">$1</h2>');

        // 6. List items: - text or * text
        escaped = escaped.replace(/^\s*[-*]\s+(.*$)/gim, '<div class="ai-chat-bullet">• $1</div>');
        // Numbered list: 1. text
        escaped = escaped.replace(/^\s*(\d+)\.\s+(.*$)/gim, '<div class="ai-chat-bullet"><span class="ai-bullet-num">$1.</span> $2</div>');

        // 7. Line breaks
        escaped = escaped.replace(/\n/g, '<br/>');

        return this.sanitizer.bypassSecurityTrustHtml(escaped);
    }

    sendQuestion(customQuery?: string): void {
        const query = (customQuery || this.chatQuery()).trim();
        if (!query || this.isAsking()) return;

        // Thêm câu hỏi của user vào danh sách
        const userMsg: ChatMessageItem = {
            sender: 'user',
            text: query,
            time: new Date(),
        };

        this.messages.update((list) => [...list, userMsg]);
        this.chatQuery.set('');
        this.isAsking.set(true);
        this.scrollToBottom();

        this.meetingService.askMeetingAi(this.meetingId(), query).subscribe({
            next: (res) => {
                const aiMsg: ChatMessageItem = {
                    sender: 'ai',
                    text: res.answer,
                    citations: res.citations,
                    time: new Date(),
                    model: res.model,
                    isFallback: !res.success,
                };
                this.messages.update((list) => [...list, aiMsg]);
                this.isAsking.set(false);
                this.scrollToBottom();
            },
            error: (err) => {
                this.isAsking.set(false);
                const errorMsg: ChatMessageItem = {
                    sender: 'ai',
                    text: `⚠️ Không thể nhận phản hồi từ AI: ${err.message || 'Lỗi kết nối máy chủ.'}`,
                    time: new Date(),
                    isFallback: true,
                };
                this.messages.update((list) => [...list, errorMsg]);
                this.scrollToBottom();
            },
        });
    }

    loadTranscripts(): void {
        this.isLoadingTranscripts.set(true);
        this.meetingService.getTranscripts(this.meetingId()).subscribe({
            next: (res) => {
                this.transcripts.set(res);
                this.isLoadingTranscripts.set(false);
            },
            error: () => {
                this.isLoadingTranscripts.set(false);
            },
        });
    }

    copyText(text: string): void {
        if (!text) return;
        navigator.clipboard.writeText(text).then(
            () => this.message.success('Đã sao chép vào bộ nhớ tạm.'),
            () => this.message.error('Không thể sao chép.')
        );
    }

    copyAllTranscripts(): void {
        const list = this.transcripts();
        if (!list || list.length === 0) {
            this.message.warning('Chưa có dữ liệu phiên âm để sao chép.');
            return;
        }

        const fullText = list
            .map((c) => `[${c.speakerName}]: ${c.text}`)
            .join('\n');
        this.copyText(fullText);
    }
}

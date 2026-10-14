import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { sanitizeHtml } from '../../core/security/html-sanitize';

/**
 * Markdown tối giản cho câu trả lời AI (P14): tiêu đề #, **đậm**, *nghiêng*, `code`, danh sách - / 1., đoạn văn, xuống dòng.
 * HTML gốc bị escape trước khi dựng thẻ, kết quả qua DOMPurify (profile richText).
 */
@Pipe({ name: 'markdown', standalone: true })
export class MarkdownPipe implements PipeTransform {
    constructor(private sanitizer: DomSanitizer) { }

    transform(value: string | null | undefined): SafeHtml {
        if (!value) return '';
        return this.sanitizer.bypassSecurityTrustHtml(sanitizeHtml(MarkdownPipe.render(value), 'richText'));
    }

    static render(src: string): string {
        const lines = escapeHtml(src.replace(/\r\n?/g, '\n')).split('\n');
        const out: string[] = [];
        let list: 'ul' | 'ol' | null = null;
        let para: string[] = [];

        const flushPara = () => {
            if (para.length) out.push(`<p>${para.map(inline).join('<br>')}</p>`);
            para = [];
        };
        const closeList = () => {
            if (list) out.push(`</${list}>`);
            list = null;
        };

        for (const raw of lines) {
            const line = raw.trimEnd();
            const heading = /^(#{1,4})\s+(.*)$/.exec(line);
            const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
            const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
            if (!line.trim()) {
                flushPara();
                closeList();
            } else if (heading) {
                flushPara();
                closeList();
                const level = Math.min(heading[1].length + 2, 6);
                out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
            } else if (bullet || ordered) {
                flushPara();
                const kind = bullet ? 'ul' : 'ol';
                if (list !== kind) {
                    closeList();
                    out.push(`<${kind}>`);
                    list = kind;
                }
                out.push(`<li>${inline((bullet ?? ordered)![1])}</li>`);
            } else {
                closeList();
                para.push(line);
            }
        }
        flushPara();
        closeList();
        return out.join('');
    }
}

function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inline(s: string): string {
    return s
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
}

import DOMPurify, { type Config } from 'dompurify';

/** Rich text / chat / markdown output */
const RICH_TEXT_CONFIG: Config = {
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'em', 'b', 'i', 'u', 'a', 'ul', 'ol', 'li',
    'code', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'span', 'div', 'img',
  ],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'src', 'alt', 'colspan', 'rowspan'],
  ALLOW_DATA_ATTR: false,
};

/** Inbound email HTML (strip scripts, event handlers, javascript: URLs) */
const EMAIL_CONFIG: Config = {
  ALLOWED_TAGS: [
    ...RICH_TEXT_CONFIG.ALLOWED_TAGS!,
    'style', 'font', 'center', 'hr', 'sub', 'sup',
  ],
  ALLOWED_ATTR: [
    ...(RICH_TEXT_CONFIG.ALLOWED_ATTR as string[]),
    'style', 'width', 'height', 'align', 'bgcolor', 'border', 'cellpadding', 'cellspacing',
  ],
  ALLOW_DATA_ATTR: false,
};

export type HtmlSanitizeProfile = 'richText' | 'email';

export function sanitizeHtml(dirty: string | null | undefined, profile: HtmlSanitizeProfile = 'richText'): string {
  if (!dirty) return '';
  const cfg = profile === 'email' ? EMAIL_CONFIG : RICH_TEXT_CONFIG;
  return DOMPurify.sanitize(dirty, cfg);
}

/** Strip tags for plain-text extraction (avoids assigning raw HTML to innerHTML). */
export function htmlToPlainText(html: string | null | undefined): string {
  if (!html) return '';
  const clean = sanitizeHtml(html, 'email');
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  return (doc.body.textContent || '').replace(/\s+\n/g, '\n').trim();
}

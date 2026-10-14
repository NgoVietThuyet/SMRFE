import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { HtmlSanitizeProfile, sanitizeHtml } from '../security/html-sanitize';

@Pipe({ name: 'sanitizeHtml', standalone: true })
export class SanitizeHtmlPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(value: string | null | undefined, profile: HtmlSanitizeProfile = 'richText'): SafeHtml {
    if (!value) return '';
    return this.sanitizer.bypassSecurityTrustHtml(sanitizeHtml(value, profile));
  }
}

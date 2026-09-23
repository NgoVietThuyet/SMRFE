import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-custom-icon-border',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="icon-border-wrapper"
      [style.width]="containerSize"
      [style.height]="containerSize"
      [style.border-radius]="computedRadius"
      [style.background]="bgColor">
      <span *ngIf="svgIcon"
        [style.width]="iconSize"
        [style.height]="iconSize"
        [innerHTML]="svgIcon">
      </span>
    </div>
  `,
    styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }
    .icon-border-wrapper {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
    }
    ::ng-deep span > svg {
      width: 100%;
      height: 100%;
    }
  `]
})
export class CustomIconBorderComponent implements OnChanges {
    /** Tên file SVG trong /Icon/ (public/Icon -> serve tại /Icon) */
    @Input() name: string = '';

    /** Kích thước icon SVG bên trong (px), mặc định 32 */
    @Input() size: string | number = 32;

    /** Kích thước khung bao ngoài (px), mặc định 56 */
    @Input() boxSize: string | number = 56;

    /** Màu nền khung bao, mặc định xanh nhạt */
    @Input() bgColor: string = '#e8f0fe';

    /** Border-radius khung bao (px), mặc định 5 */
    @Input() radius: string | number = 5;

    svgIcon: SafeHtml | null = null;
    private sub?: Subscription;

    constructor(private http: HttpClient, private sanitizer: DomSanitizer) { }

    get containerSize(): string {
        const n = Number(this.boxSize);
        return (!isNaN(n) && n > 0) ? `${n}px` : String(this.boxSize);
    }

    get iconSize(): string {
        const n = Number(this.size);
        return (!isNaN(n) && n > 0) ? `${n}px` : String(this.size);
    }

    get computedRadius(): string {
        const n = Number(this.radius);
        return (!isNaN(n) && n >= 0) ? `${n}px` : String(this.radius);
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['name']) {
            this.loadSvg();
        }
    }

    private loadSvg() {
        if (!this.name) {
            this.svgIcon = null;
            return;
        }

        const url = `/Icon/${this.name}.svg`;
        if (this.sub) this.sub.unsubscribe();

        this.sub = this.http.get(url, { responseType: 'text' }).subscribe({
            next: (val) => {
                // Xem giải thích ở CustomIconComponent.loadSvg(): khi file .svg không tồn tại,
                // server có thể trả 200 kèm index.html (SPA fallback) thay vì 404 - chỉ chấp
                // nhận nội dung thực sự là SVG để tránh nhân bản index.html (và #global-loading)
                // vào giữa trang.
                this.svgIcon = this.isSvgContent(val) ? this.sanitizer.bypassSecurityTrustHtml(val) : null;
            },
            error: () => {
                this.svgIcon = null;
            }
        });
    }

    private isSvgContent(val: string): boolean {
        return /^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(val || '');
    }
}

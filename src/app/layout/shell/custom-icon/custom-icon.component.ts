import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-custom-icon',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span *ngIf="svgIcon" [class]="customClass" [style.width]="computedWidth" [style.height]="computedHeight" [ngClass]="{'icon-bold': bold}" [innerHTML]="svgIcon"></span>
    <img *ngIf="!svgIcon && name" [src]="iconUrl" [class]="customClass" (error)="onImgError($event)" (load)="onImgLoad($event)" [style.width]="computedWidth" [style.height]="computedHeight" alt="icon" style="display: none;" />
  `,
  styles: [`
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
      width: var(--icon-size, 24px);
      height: var(--icon-size, 24px);
    }
    :host(.iconSizeType1) { --icon-size: 24px; }
    :host(.iconSizeType2) { --icon-size: 32px; }
    :host(.iconSizeType3) { --icon-size: 56px; }
    ::ng-deep .icon-bold svg path, ::ng-deep .icon-bold.custom-icon svg path {
      stroke-width: 2 !important;
    }
    ::ng-deep .icon-color-inherit svg [stroke]:not([stroke="none"]) {
      stroke: currentColor !important;
    }
    ::ng-deep .icon-color-inherit svg [fill]:not([fill="none"]) {
      fill: currentColor !important;
    }
    ::ng-deep .icon-white svg path, ::ng-deep .icon-white.custom-icon svg path {
      stroke: #ffffff !important;
    }
    /* Fallback in case SVG uses fill instead of stroke */
    ::ng-deep .icon-white {
      filter: brightness(0) invert(1);
    }
    span {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
    }
    ::ng-deep span > svg {
      width: 100%;
      height: 100%;
    }
  `]
})
export class CustomIconComponent implements OnChanges {
  @Input() name: string = '';
  @Input() size: string | number = '';
  @Input() customClass: string = '';
  @Input() width: string | number = '';
  @Input() height: string | number = '';
  @Input() bold: boolean = false;

  get computedWidth(): string {
    if (this.width) {
      const num = Number(this.width);
      return isNaN(num) ? String(this.width) : `${num}px`;
    }
    if (this.size) return this.getIconSize();
    return '';
  }

  get computedHeight(): string {
    if (this.height) {
      const num = Number(this.height);
      return isNaN(num) ? String(this.height) : `${num}px`;
    }
    if (this.size) return this.getIconSize();
    return '';
  }

  private getIconSize(): string {
    const s = Number(this.size);
    return isNaN(s) ? '24px' : `${s}px`;
  }

  svgIcon: SafeHtml | null = null;
  private sub?: Subscription;

  constructor(private http: HttpClient, private sanitizer: DomSanitizer) { }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['name'] || changes['size']) {
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
                // Khi file .svg không tồn tại, server có thể trả 200 kèm nội dung index.html
                // (SPA fallback "try_files $uri /index.html" trên nginx production) thay vì 404.
                // Nếu tin tưởng mù quáng nội dung này và bơm thẳng qua [innerHTML], nó sẽ nhân bản
                // toàn bộ index.html (kể cả #global-loading) ngay vào giữa trang, khiến
                // document.getElementById('global-loading') từ đó luôn vớ nhầm bản sao này thay vì
                // phần tử thật -> loading toàn cục bị treo vĩnh viễn. Chỉ chấp nhận khi đúng là SVG.
                this.svgIcon = this.isSvgContent(val) ? this.sanitizer.bypassSecurityTrustHtml(val) : null;
            },
            error: () => {
                this.svgIcon = null;
            }
        });
    }

    get iconUrl(): string {
        if (!this.name) return '';
        return `/Icon/${this.name}.svg`;
  }

  /** Chỉ nhận nội dung thực sự là SVG - chặn trường hợp server trả về index.html (200) thay vì 404. */
  private isSvgContent(val: string): boolean {
    return /^\s*(<\?xml[^>]*>\s*)?<svg[\s>]/i.test(val || '');
  }

  onImgError(event: Event) {
    (event.target as HTMLImageElement).style.display = 'none';
  }

  onImgLoad(event: Event) {
    if (!this.svgIcon) {
      (event.target as HTMLImageElement).style.display = 'inline-flex';
    }
  }
}

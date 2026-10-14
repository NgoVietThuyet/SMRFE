import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SharedModules } from '../../ng-zorro.module';

/**
 * Trang tạm cho mục menu chưa làm. route.data: { title, phase } — xem Document/SMR-Phase.md.
 * Phase nào làm xong thì đổi route của mục đó sang trang thật.
 */
@Component({
  selector: 'app-under-construction',
  standalone: true,
  imports: [SharedModules],
  template: `
    <nz-page-header>
      <nz-page-header-title>{{ title | uppercase }}</nz-page-header-title>
      <nz-page-header-subtitle>Đang phát triển</nz-page-header-subtitle>
    </nz-page-header>
    <nz-result nzStatus="info" nzIcon="tool" [nzTitle]="title" [nzSubTitle]="subtitle">
      <div nz-result-extra>
        <button nz-button nzType="primary" (click)="backHome()">Về Tổng quan</button>
      </div>
    </nz-result>
  `,
})
export class UnderConstruction {
  readonly title: string;
  readonly subtitle: string;

  constructor(route: ActivatedRoute, private router: Router) {
    this.title = route.snapshot.data['title'] ?? 'Chức năng';
    const phase = route.snapshot.data['phase'];
    this.subtitle = phase
      ? `Chức năng này đang được xây dựng (${phase} trong lộ trình).`
      : 'Chức năng này đang được xây dựng.';
  }

  backHome(): void {
    this.router.navigate(['/dashboard']);
  }
}

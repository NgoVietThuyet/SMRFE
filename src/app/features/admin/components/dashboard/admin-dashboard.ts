import { Component, OnDestroy, OnInit } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Subject, forkJoin, takeUntil } from 'rxjs';
import { NzTreeNodeOptions } from 'ng-zorro-antd/tree';
import {
  ApexAxisChartSeries, ApexChart, ApexDataLabels, ApexLegend, ApexPlotOptions, ApexXAxis,
  ApexYAxis, NgApexchartsModule,
} from 'ng-apexcharts';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { GlobalService } from '../../../../core';
import { readCssSystemPrimary } from '../../../../core/utils/theme-tokens';
import { OrganizationService } from '../../services/organization.service';
import { SystemService } from '../../services/system.service';
import { RoomService } from '../../../meeting/services/room.service';
import { NzMessageService } from 'ng-zorro-antd/message';
import { finalize, switchMap, of } from 'rxjs';
import { HumanResourceSummary, MeetingReport, TaskReport } from '../../models/admin.models';

/** P5 — Thống kê toàn hệ thống (mẫu 2.FrontEnd hrm-dashboard / ast-dashboard). */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [SharedModules, NgApexchartsModule],
  providers: [DatePipe],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss'
})
export class AdminDashboard implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  range: Date[] = AdminDashboard.defaultRange();
  organizationId: string | null = null;
  orgTree: NzTreeNodeOptions[] = [];

  hr: HumanResourceSummary | null = null;
  meeting: MeetingReport | null = null;
  task: TaskReport | null = null;
  loading = false;

  // ── Biểu đồ ──
  weekSeries: ApexAxisChartSeries = [];
  weekXAxis: ApexXAxis = { categories: [] };
  readonly weekChart: ApexChart = { type: 'bar', height: 280, toolbar: { show: false }, fontFamily: 'inherit' };
  readonly weekPlot: ApexPlotOptions = { bar: { columnWidth: '45%', borderRadius: 4 } };
  readonly weekYAxis: ApexYAxis[] = [
    { title: { text: 'Cuộc họp' }, labels: { formatter: v => `${Math.round(v)}` } },
    { opposite: true, title: { text: 'Giờ' }, labels: { formatter: v => v.toFixed(1) } },
  ];
  readonly weekColors = [readCssSystemPrimary(), '#52c41a'];

  readonly donutChart: ApexChart = { type: 'donut', height: 260, fontFamily: 'inherit' };
  readonly donutLegend: ApexLegend = { position: 'bottom' };
  readonly donutLabels: ApexDataLabels = { enabled: true, formatter: (v: number) => `${Math.round(v)}%` };
  meetingStatusSeries: number[] = [];
  readonly meetingStatusLabels = ['Nháp', 'Sắp diễn ra', 'Đang diễn ra', 'Đã kết thúc', 'Đã hủy'];
  readonly meetingStatusColors = ['#bfbfbf', readCssSystemPrimary(), '#fa8c16', '#52c41a', '#ff4d4f'];
  taskSeries: number[] = [];
  readonly taskLabels = ['Chưa bắt đầu', 'Đang làm', 'Hoàn thành'];
  readonly taskColors = ['#bfbfbf', '#fa8c16', '#52c41a'];

  constructor(
    private global: GlobalService,
    private service: SystemService,
    private orgService: OrganizationService,
    private datePipe: DatePipe,
    private room: RoomService,
    private message: NzMessageService,
  ) {
    this.global.setBreadcrumb([{ name: 'Thống kê', path: 'admin/dashboard' }]);
  }

  // Xuất XLSX tham dự (P10): admin nhập mã phòng của cuộc họp bất kỳ.
  exportCode = '';
  exporting = false;

  exportAttendance(): void {
    const code = this.exportCode.trim().toUpperCase();
    if (!code || this.exporting) return;
    this.exporting = true;
    this.room.publicInfo(code).pipe(
      switchMap(info => {
        if (!info?.meetingId) {
          this.message.warning('Không tìm thấy cuộc họp với mã này');
          return of(null);
        }
        return this.room.exportAttendance(info.meetingId);
      }),
      finalize(() => this.exporting = false),
      takeUntil(this.destroy$),
    ).subscribe(file => {
      if (!file) return;
      const url = URL.createObjectURL(file.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  ngOnInit(): void {
    this.orgService.tree(false).pipe(takeUntil(this.destroy$))
      .subscribe(list => this.orgTree = OrganizationService.toNzTree(list ?? [], { expandAll: true }));
    this.service.hrSummary().pipe(takeUntil(this.destroy$)).subscribe(res => this.hr = res);
    this.load();
  }

  /** Mặc định 30 ngày gần nhất. */
  private static defaultRange(): Date[] {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 29);
    return [from, to];
  }

  private toIsoDate(date: Date): string {
    return this.datePipe.transform(date, 'yyyy-MM-dd') ?? '';
  }

  load(): void {
    if (!this.range?.[0] || !this.range?.[1]) {
      this.range = AdminDashboard.defaultRange();
    }
    const from = this.toIsoDate(this.range[0]);
    const to = this.toIsoDate(this.range[1]);
    this.loading = true;
    forkJoin([
      this.service.meetingReport(from, to, this.organizationId),
      this.service.taskReport(from, to),
    ])
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ([meeting, task]) => {
          this.meeting = meeting;
          this.task = task;
          this.buildCharts();
          this.loading = false;
        },
        error: () => this.loading = false,
      });
  }

  reset(): void {
    this.range = AdminDashboard.defaultRange();
    this.organizationId = null;
    this.load();
  }

  private buildCharts(): void {
    const m = this.meeting;
    if (m) {
      this.weekXAxis = { categories: m.byWeek.map(w => `Tuần ${this.datePipe.transform(w.weekStart, 'dd/MM')}`) };
      this.weekSeries = [
        { name: 'Số cuộc họp', type: 'column', data: m.byWeek.map(w => w.meetingCount) },
        { name: 'Giờ họp', type: 'line', data: m.byWeek.map(w => w.hours) },
      ];
      this.meetingStatusSeries = [m.draftCount, m.upcomingCount, m.ongoingCount, m.endedCount, m.cancelledCount];
    }
    const t = this.task;
    if (t) {
      this.taskSeries = [t.notStarted, t.inProgress, t.completed];
    }
  }

  get attendanceRate(): number {
    const m = this.meeting;
    return m && m.participantCount ? Math.round((m.attendedCount / m.participantCount) * 100) : 0;
  }

  hasData(series: number[]): boolean {
    return series.some(v => v > 0);
  }

  ngOnDestroy(): void {
    this.global.setBreadcrumb([]);
    this.destroy$.next();
    this.destroy$.complete();
  }
}

import { Component, EventEmitter, Input, OnChanges, OnDestroy, Output, SimpleChanges } from '@angular/core';
import { Subject, debounceTime, distinctUntilChanged, finalize, switchMap, takeUntil } from 'rxjs';
import { SharedModules } from '../../../../shared/ng-zorro.module';
import { UserSearchItem } from '../../../meeting/models/meeting.models';
import { MeetingService } from '../../../meeting/services/meeting.service';
import { TaskShare } from '../../models/task.models';
import { TaskService } from '../../services/task.service';
import { TaskUi } from '../../utils/task-ui';

/** Chia sẻ công việc (chỉ người tạo): công khai / riêng tư + danh sách người được chia sẻ quyền Xem / Sửa. */
@Component({
  selector: 'app-task-share-modal',
  standalone: true,
  imports: [SharedModules],
  template: `
    <nz-modal [nzVisible]="!!workId" nzTitle="Chia sẻ công việc" [nzFooter]="null" (nzOnCancel)="close()" [nzWidth]="520">
      <ng-container *nzModalContent>
        <div class="share-public">
          <div>
            <b>{{ isPublic ? 'Công khai' : 'Riêng tư' }}</b>
            <div class="muted">{{ isPublic ? 'Mọi người trong hệ thống xem được (không sửa được).' : 'Chỉ người được chia sẻ, người thực hiện và thành viên cuộc họp xem được.' }}</div>
          </div>
          <nz-switch [ngModel]="isPublic" (ngModelChange)="togglePublic($event)" aria-label="Công khai"></nz-switch>
        </div>

        <label class="text-control">Thêm người</label>
        <div class="share-add">
          <nz-select class="share-user" nzShowSearch nzServerSearch nzAllowClear nzPlaceHolder="Gõ tên hoặc email"
            [nzLoading]="searching" [(ngModel)]="pickUser" (nzOnSearch)="search$.next($event)" aria-label="Người được chia sẻ">
            @for (u of users; track u.userName) { <nz-option [nzValue]="u.userName" [nzLabel]="u.fullName + ' · ' + u.email"></nz-option> }
          </nz-select>
          <nz-select class="share-perm" [(ngModel)]="pickPermission" aria-label="Quyền">
            <nz-option [nzValue]="0" nzLabel="Xem"></nz-option>
            <nz-option [nzValue]="1" nzLabel="Sửa"></nz-option>
          </nz-select>
          <button nz-button nzType="primary" [disabled]="!pickUser" [nzLoading]="busy" (click)="add()">Chia sẻ</button>
        </div>

        <div class="share-list">
          @if (loading) { <nz-spin nzSimple class="spin"></nz-spin> }
          @for (s of shares; track s.userName) {
          <div class="share-row">
            <nz-avatar nzSize="small" [nzText]="ui.initials(s.fullName)" [style.background]="ui.colorOf(s.userName)"></nz-avatar>
            <span class="share-name">{{ s.fullName }}</span>
            <nz-tag [nzColor]="s.permission === 1 ? 'blue' : 'default'">{{ s.permission === 1 ? 'Sửa' : 'Xem' }}</nz-tag>
            <button nz-button nzType="text" nzSize="small" nzDanger (click)="remove(s)" aria-label="Bỏ chia sẻ"><nz-icon nzType="close" /></button>
          </div>
          }
          @if (!loading && !shares.length) { <div class="muted empty">Chưa chia sẻ cho ai.</div> }
        </div>
      </ng-container>
    </nz-modal>
  `,
  styles: [`
    .share-public { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 10px 12px;
      background: #f4f5f7; border-radius: 6px; margin-bottom: 16px; }
    .muted { color: #8c8c8c; font-size: 12px; }
    .share-add { display: flex; gap: 8px; margin-bottom: 12px; }
    .share-user { flex: 1; min-width: 0; }
    .share-perm { width: 90px; }
    .share-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid #f5f5f5; }
    .share-name { flex: 1; }
    .spin { display: block; margin: 12px auto; }
    .empty { padding: 8px 0; }
  `],
})
export class TaskShareModal implements OnChanges, OnDestroy {
  @Input() workId: string | null = null;
  @Output() workIdChange = new EventEmitter<string | null>();
  @Output() changed = new EventEmitter<void>();

  private destroy$ = new Subject<void>();
  readonly search$ = new Subject<string>();
  readonly ui = TaskUi;
  shares: TaskShare[] = [];
  isPublic = false;
  loading = false;
  busy = false;
  users: UserSearchItem[] = [];
  searching = false;
  pickUser: string | null = null;
  pickPermission: 0 | 1 = 0;

  constructor(private service: TaskService, private meetings: MeetingService) {
    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(q => {
        this.searching = true;
        return this.meetings.searchUsers(q.trim(), 10).pipe(finalize(() => this.searching = false));
      }),
      takeUntil(this.destroy$),
    ).subscribe(list => {
      const taken = new Set(this.shares.map(s => s.userName.toLowerCase()));
      this.users = (list ?? []).filter(u => !taken.has(u.userName.toLowerCase()));
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['workId'] && this.workId) this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private load(): void {
    this.loading = true;
    this.service.detail(this.workId!).pipe(finalize(() => this.loading = false), takeUntil(this.destroy$)).subscribe(d => {
      this.shares = d.shares ?? [];
      this.isPublic = !!d.isPublic;
    });
  }

  togglePublic(on: boolean): void {
    this.service.setVisibility(this.workId!, on).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.isPublic = on;
      this.changed.emit();
    });
  }

  add(): void {
    if (!this.pickUser || this.busy) return;
    this.busy = true;
    this.service.addShare(this.workId!, this.pickUser, this.pickPermission)
      .pipe(finalize(() => this.busy = false), takeUntil(this.destroy$))
      .subscribe(d => {
        this.shares = d.shares ?? [];
        this.pickUser = null;
        this.changed.emit();
      });
  }

  remove(s: TaskShare): void {
    this.service.removeShare(this.workId!, s.userName).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.shares = this.shares.filter(x => x.userName !== s.userName);
      this.changed.emit();
    });
  }

  close(): void {
    this.workIdChange.emit(null);
  }
}

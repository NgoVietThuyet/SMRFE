import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, finalize, switchMap, takeUntil } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { SharedModules } from '../../../shared/ng-zorro.module';
import { AuthService } from '../../../shared/services';
import { AccountInfo, GlobalService, SessionService } from '../../../core';

/** UserProfileResponse — GET/PUT /api/Auth/Profile. */
class ProfileDto {
  userName: string = '';
  fullName: string = '';
  email: string = '';
  phone: string = '';
  address: string = '';
  organizationName: string = '';
  titleName: string = '';
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [SharedModules],
  templateUrl: './profile.html',
  styleUrl: './profile.scss'
})
export class Profile implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  dto: ProfileDto = new ProfileDto();
  private original: ProfileDto = new ProfileDto();
  accountInfo: AccountInfo | null = null;
  isEditMode = false;
  isSaving = false;

  constructor(
    private global: GlobalService,
    private session: SessionService,
    private authService: AuthService,
    private message: NzMessageService,
  ) {
    this.global.setBreadcrumb([{ name: 'Thông tin cá nhân', path: 'profile' }]);
  }

  ngOnInit(): void {
    this.accountInfo = this.session.accountInfo;
    this.loadProfile();
  }

  loadProfile(): void {
    this.authService.getProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe((res: ProfileDto) => {
        this.dto = { ...new ProfileDto(), ...res };
        this.original = { ...this.dto };
      });
  }

  saveProfile(): void {
    const { fullName, email, phone, address } = this.dto;
    if (!fullName?.trim() || !email?.trim()) {
      this.message.warning('Vui lòng nhập họ tên và email');
      return;
    }
    this.isSaving = true;
    this.authService.updateProfile({ fullName: fullName.trim(), email: email.trim(), phone: phone ?? '', address: address ?? '' })
      .pipe(
        switchMap(() => this.session.load()),
        finalize(() => this.isSaving = false),
        takeUntil(this.destroy$),
      )
      .subscribe(() => {
        this.isEditMode = false;
        this.accountInfo = this.session.accountInfo;
        this.loadProfile();
      });
  }

  cancelEdit(): void {
    this.dto = { ...this.original };
    this.isEditMode = false;
  }

  getInitials(): string {
    return this.global.getInitialsAvatar(this.dto.fullName || this.dto.userName);
  }

  getAvatarColor(): string {
    return this.global.getAvatarColor(this.dto.userName || this.dto.fullName);
  }

  ngOnDestroy(): void {
    this.global.setBreadcrumb([]);
    this.destroy$.next();
    this.destroy$.complete();
  }
}

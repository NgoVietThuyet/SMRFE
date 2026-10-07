import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { AuthService } from '../../core/services/auth.service';
import type { UserProfile } from '../../core/models/auth.models';
import { friendlyError } from '../../shared/utils/friendly-error';

@Component({
    selector: 'app-profile',
    templateUrl: './profile.html',
    styleUrl: './profile.scss',
    imports: [ReactiveFormsModule, NzButtonModule, NzFormModule, NzInputModule, NzSpinModule],
})
export class Profile implements OnInit {
    private readonly auth = inject(AuthService);
    private readonly fb = inject(FormBuilder);
    private readonly message = inject(NzMessageService);

    readonly profile = signal<UserProfile | null>(null);
    readonly loading = signal(true);
    readonly saving = signal(false);
    readonly loadError = signal<string | null>(null);
    readonly saveError = signal<string | null>(null);

    readonly form = this.fb.nonNullable.group({
        fullName: ['', [Validators.required, Validators.maxLength(200)]],
        email: ['', [Validators.required, Validators.email, Validators.maxLength(200)]],
        phone: ['', [Validators.maxLength(50)]],
        address: ['', [Validators.maxLength(500)]],
    });

    ngOnInit(): void {
        this.loadProfile();
    }

    loadProfile(): void {
        this.loading.set(true);
        this.loadError.set(null);
        this.auth.getProfile().subscribe({
            next: (profile) => {
                this.profile.set(profile);
                this.form.patchValue({
                    fullName: profile.fullName,
                    email: profile.email,
                    phone: profile.phone,
                    address: profile.address,
                });
                this.loading.set(false);
            },
            error: (error: unknown) => {
                this.loadError.set(friendlyError(error, 'Không thể tải thông tin cá nhân.'));
                this.loading.set(false);
            },
        });
    }

    save(): void {
        this.saveError.set(null);
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }

        this.saving.set(true);
        this.auth.updateProfile(this.form.getRawValue()).subscribe({
            next: (profile) => {
                this.profile.set(profile);
                this.form.markAsPristine();
                this.message.success('Cập nhật thông tin cá nhân thành công.');
                this.saving.set(false);
            },
            error: (error: unknown) => {
                const message = error instanceof Error ? error.message : 'Cập nhật thông tin cá nhân thất bại.';
                this.saveError.set(message);
                this.message.error(message);
                this.saving.set(false);
            },
        });
    }
}

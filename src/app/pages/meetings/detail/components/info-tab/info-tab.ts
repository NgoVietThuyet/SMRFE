import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { MeetingService } from '../../../../../core/services/meeting.service';
import {
    MeetingDetailDto,
    UpdateMeetingRequest,
} from '../../../../../core/models/meeting.models';
import { MeetingStatus, MeetingVisibility } from '../../../../../core/models/dashboard.models';

// =====================================================
// InfoTab — tab Thông tin chung: xem + sửa (PATCH).
// Field đúng DTO BE: name/desc/agenda/times/visibility.
// Participants sửa ở tab Người tham gia (API riêng).
// =====================================================
@Component({
    selector: 'app-info-tab',
    templateUrl: './info-tab.html',
    styleUrl: './info-tab.scss',
    imports: [
        ReactiveFormsModule,
        NzButtonModule,
        NzDatePickerModule,
        NzInputModule,
        NzSelectModule,
    ],
})
export class InfoTab {
    private readonly fb = inject(FormBuilder);
    private readonly meetingService = inject(MeetingService);
    private readonly destroyRef = inject(DestroyRef);

    meeting = input.required<MeetingDetailDto>();
    updated = output<MeetingDetailDto>();

    editing = signal<boolean>(false);
    saving = signal<boolean>(false);
    saveError = signal<string | null>(null);

    readonly visibilityOptions = [
        { value: MeetingVisibility.InvitedOnly, label: 'Chỉ người được mời' },
        { value: MeetingVisibility.Internal, label: 'Nội bộ' },
        { value: MeetingVisibility.Public, label: 'Công khai' },
    ];

    readonly form = this.fb.group({
        name: ['', [Validators.required, Validators.maxLength(200)]],
        description: ['', [Validators.maxLength(4000)]],
        agenda: ['', [Validators.maxLength(8000)]],
        expectedStartTime: [null as Date | null, [Validators.required]],
        expectedEndTime: [null as Date | null],
        visibility: [MeetingVisibility.InvitedOnly],
    });

    canEdit(): boolean {
        const m = this.meeting();
        if (!m.canManage) return false;
        return !(
            m.status === MeetingStatus.Ended ||
            m.status === MeetingStatus.Cancelled ||
            m.status === MeetingStatus.Archived
        );
    }

    startEdit(): void {
        if (!this.canEdit()) return;
        const m = this.meeting();
        this.form.setValue({
            name: m.name,
            description: m.description ?? '',
            agenda: m.agenda ?? '',
            expectedStartTime: m.expectedStartTime ? new Date(m.expectedStartTime) : null,
            expectedEndTime: m.expectedEndTime ? new Date(m.expectedEndTime) : null,
            visibility: m.visibility,
        });
        this.saveError.set(null);
        this.editing.set(true);
    }

    cancelEdit(): void {
        if (this.saving()) return;
        this.editing.set(false);
    }

    save(): void {
        if (this.form.invalid || this.endAfterStart()) {
            this.form.markAllAsTouched();
            return;
        }
        const m = this.meeting();
        const v = this.form.getRawValue();
        const payload: UpdateMeetingRequest = {
            name: v.name!.trim(),
            description: v.description?.trim() ?? '',
            agenda: v.agenda?.trim() ?? '',
            expectedStartTime: (v.expectedStartTime as Date).toISOString(),
            expectedEndTime: v.expectedEndTime ? (v.expectedEndTime as Date).toISOString() : null,
            timeZone: m.timeZone || 'Asia/Bangkok',
            visibility: v.visibility ?? MeetingVisibility.InvitedOnly,
            settings: { ...m.settings },
            rowVersion: m.rowVersion ?? '',
        };
        this.saving.set(true);
        this.saveError.set(null);
        this.meetingService
            .update(m.id, payload)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (detail) => {
                    this.saving.set(false);
                    this.editing.set(false);
                    this.updated.emit(detail);
                },
                error: (err: Error) => {
                    this.saving.set(false);
                    this.saveError.set(err.message || 'Lưu thay đổi thất bại.');
                },
            });
    }

    visibilityLabel(visibility: number): string {
        return this.visibilityOptions.find((o) => o.value === visibility)?.label ?? '—';
    }

    endAfterStart(): boolean {
        const start = this.form.controls.expectedStartTime.value;
        const end = this.form.controls.expectedEndTime.value;
        return !!start && !!end && end <= start;
    }
}

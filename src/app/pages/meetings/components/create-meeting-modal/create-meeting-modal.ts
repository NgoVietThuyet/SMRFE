import { Component, DestroyRef, inject, input, output, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
    AbstractControl,
    FormBuilder,
    ReactiveFormsModule,
    ValidationErrors,
    Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';
import { MeetingService } from '../../../../core/services/meeting.service';
import {
    CreateMeetingRequest,
    MeetingVisibility,
    UserSearchItem,
} from '../../../../core/models/meeting.models';

// Validator chung: kết thúc phải sau bắt đầu và không quá 24h (khớp BE ValidateSchedule)
function endTimeValidator(control: AbstractControl): ValidationErrors | null {
    const start: Date | null = control.get('expectedStartTime')?.value ?? null;
    const end: Date | null = control.get('expectedEndTime')?.value ?? null;
    if (!start || !end) return null;
    if (end <= start) return { endBeforeStart: true };
    if (end.getTime() - start.getTime() > 24 * 60 * 60 * 1000) return { tooLong: true };
    return null;
}

// =====================================================
// CreateMeetingModal — popup tạo cuộc họp.
// Field map 1:1 CreateMeetingDto (POST /api/Meeting).
// Người tham gia gợi ý từ GET /api/User/Search.
// Không có field mật khẩu phòng: BE chưa hash phía server.
// =====================================================
@Component({
    selector: 'app-create-meeting-modal',
    templateUrl: './create-meeting-modal.html',
    styleUrl: './create-meeting-modal.scss',
    imports: [
        ReactiveFormsModule,
        NzModalModule,
        NzInputModule,
        NzSelectModule,
        NzDatePickerModule,
        NzSwitchModule,
        NzButtonModule,
    ],
})
export class CreateMeetingModal {
    private readonly fb = inject(FormBuilder);
    private readonly meetingService = inject(MeetingService);
    private readonly destroyRef = inject(DestroyRef);

    open = input<boolean>(false);
    closed = output<void>();
    created = output<string>();

    readonly MeetingVisibility = MeetingVisibility;

    readonly visibilityOptions = [
        { value: MeetingVisibility.InvitedOnly, label: 'Chỉ người được mời' },
        { value: MeetingVisibility.Internal, label: 'Nội bộ' },
        { value: MeetingVisibility.Public, label: 'Công khai' },
    ];

    readonly form = this.fb.group(
        {
            name: ['', [Validators.required, Validators.maxLength(200)]],
            description: ['', [Validators.maxLength(4000)]],
            agenda: ['', [Validators.maxLength(8000)]],
            expectedStartTime: [null as Date | null, [Validators.required]],
            expectedEndTime: [null as Date | null],
            visibility: [MeetingVisibility.InvitedOnly],
            participantUserNames: [[] as string[]],
            settings: this.fb.group({
                lobbyEnabled: [false],
                allowGuests: [false],
                allowJoinBeforeHost: [false],
                chatEnabled: [true],
                screenShareEnabled: [true],
                whiteboardEnabled: [true],
                fileUploadEnabled: [true],
                recordingEnabled: [true],
                captionsEnabled: [false],
                aiMinutesEnabled: [false],
            }),
        },
        { validators: endTimeValidator }
    );

    readonly saving = signal<'create' | 'draft' | null>(null);
    readonly submitError = signal<string | null>(null);

    // Gợi ý người tham gia (server search, debounce)
    private readonly userSearch$ = new Subject<string>();
    private readonly knownUsers = signal(new Map<string, UserSearchItem>());
    readonly searchedUsers = signal<UserSearchItem[]>([]);
    readonly searchingUsers = signal(false);

    readonly participantOptions = computed(() => {
        const map = new Map<string, UserSearchItem>();
        for (const u of this.searchedUsers()) map.set(u.userName, u);
        const selected = this.form.controls.participantUserNames.value ?? [];
        const known = this.knownUsers();
        for (const name of selected) {
            if (!map.has(name)) {
                map.set(name, known.get(name) ?? { userName: name, fullName: name, email: '' });
            }
        }
        return [...map.values()];
    });

    constructor() {
        this.userSearch$
            .pipe(
                debounceTime(300),
                distinctUntilChanged(),
                switchMap((q) => {
                    if (!q.trim()) {
                        this.searchingUsers.set(false);
                        return [];
                    }
                    this.searchingUsers.set(true);
                    return this.meetingService.searchUsers(q);
                }),
                takeUntilDestroyed(this.destroyRef)
            )
            .subscribe({
                next: (users) => {
                    this.searchingUsers.set(false);
                    this.searchedUsers.set(users);
                    if (users.length > 0) {
                        this.knownUsers.update((m) => {
                            const next = new Map(m);
                            for (const u of users) next.set(u.userName, u);
                            return next;
                        });
                    }
                },
                error: () => this.searchingUsers.set(false),
            });
    }

    onUserSearch(query: string): void {
        this.userSearch$.next(query);
    }

    close(): void {
        if (this.saving()) return;
        this.submitError.set(null);
        this.closed.emit();
    }

    submit(saveAsDraft: boolean): void {
        this.submitError.set(null);
        if (this.form.invalid) {
            this.form.markAllAsTouched();
            return;
        }
        const v = this.form.getRawValue();
        const s = v.settings ?? {};
        const payload: CreateMeetingRequest = {
            name: v.name!.trim(),
            description: v.description?.trim() ?? '',
            agenda: v.agenda?.trim() ?? '',
            expectedStartTime: (v.expectedStartTime as Date).toISOString(),
            expectedEndTime: v.expectedEndTime ? (v.expectedEndTime as Date).toISOString() : null,
            timeZone: 'Asia/Bangkok',
            visibility: v.visibility ?? MeetingVisibility.InvitedOnly,
            saveAsDraft,
            publishInvitation: true,
            settings: {
                lobbyEnabled: s.lobbyEnabled ?? false,
                allowGuests: s.allowGuests ?? false,
                allowJoinBeforeHost: s.allowJoinBeforeHost ?? false,
                chatEnabled: s.chatEnabled ?? true,
                screenShareEnabled: s.screenShareEnabled ?? true,
                whiteboardEnabled: s.whiteboardEnabled ?? true,
                fileUploadEnabled: s.fileUploadEnabled ?? true,
                recordingEnabled: s.recordingEnabled ?? true,
                captionsEnabled: s.captionsEnabled ?? false,
                aiMinutesEnabled: false,
            },
            participantUserNames: v.participantUserNames ?? [],
        };

        this.saving.set(saveAsDraft ? 'draft' : 'create');
        this.meetingService
            .create(payload)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (id) => {
                    this.saving.set(null);
                    this.form.reset({
                        visibility: MeetingVisibility.InvitedOnly,
                        participantUserNames: [],
                    });
                    this.created.emit(id);
                },
                // Lỗi BE (quá khứ, trùng lịch, tài khoản lạ...) hiện nguyên message
                error: (err: Error) => {
                    this.saving.set(null);
                    this.submitError.set(err.message || 'Tạo cuộc họp thất bại.');
                },
            });
    }
}

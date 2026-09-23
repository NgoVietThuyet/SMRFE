import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMenuModule } from 'ng-zorro-antd/menu';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { debounceTime, distinctUntilChanged, Subject, switchMap } from 'rxjs';
import { MeetingService } from '../../../../../core/services/meeting.service';
import {
    MeetingDetailDto,
    MeetingParticipantDto,
    MeetingParticipantRole,
    UserSearchItem,
} from '../../../../../core/models/meeting.models';

// =====================================================
// ParticipantsTab — người tham gia cuộc họp.
// Thêm (User/Search + POST participants), xóa (DELETE,
// confirm, canManage). Mic/camote: BE chưa có API.
// =====================================================
@Component({
    selector: 'app-participants-tab',
    templateUrl: './participants-tab.html',
    styleUrl: './participants-tab.scss',
    imports: [
        FormsModule,
        NzButtonModule,
        NzDropdownModule,
        NzEmptyModule,
        NzIconModule,
        NzInputModule,
        NzMenuModule,
        NzSelectModule,
        NzTableModule,
    ],
})
export class ParticipantsTab {
    private readonly meetingService = inject(MeetingService);
    private readonly modal = inject(NzModalService);
    private readonly destroyRef = inject(DestroyRef);

    meeting = input.required<MeetingDetailDto>();
    changed = output<MeetingDetailDto>();

    keyword = signal<string>('');
    adding = signal<boolean>(false);
    selected = signal<string[]>([]);
    searchedUsers = signal<UserSearchItem[]>([]);
    searchingUsers = signal<boolean>(false);
    mutating = signal<string | null>(null);
    private readonly userSearch$ = new Subject<string>();

    filtered = (): MeetingParticipantDto[] => {
        const q = this.keyword().trim().toLowerCase();
        const list = this.meeting().participants ?? [];
        if (!q) return list;
        return list.filter(
            (p) =>
                p.fullName.toLowerCase().includes(q) ||
                p.userName.toLowerCase().includes(q) ||
                p.email.toLowerCase().includes(q)
        );
    };

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
                    const existing = new Set(this.meeting().participants.map((p) => p.userName));
                    this.searchedUsers.set(users.filter((u) => !existing.has(u.userName)));
                },
                error: () => this.searchingUsers.set(false),
            });
    }

    onUserSearch(query: string): void {
        this.userSearch$.next(query);
    }

    openAdd(): void {
        this.selected.set([]);
        this.searchedUsers.set([]);
        this.adding.set(true);
    }

    cancelAdd(): void {
        if (this.mutating()) return;
        this.adding.set(false);
    }

    confirmAdd(): void {
        const userNames = this.selected();
        if (userNames.length === 0 || this.mutating()) return;
        this.mutating.set('add');
        this.meetingService
            .addParticipants(this.meeting().id, userNames)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe({
                next: (detail) => {
                    this.mutating.set(null);
                    this.adding.set(false);
                    this.changed.emit(detail);
                },
                error: () => this.mutating.set(null),
            });
    }

    confirmRemove(p: MeetingParticipantDto): void {
        this.modal.confirm({
            nzTitle: 'Xóa khỏi cuộc họp',
            nzContent: `Xóa ${p.fullName} khỏi cuộc họp?`,
            nzOkText: 'Xóa',
            nzOkDanger: true,
            nzCancelText: 'Hủy',
            nzOnOk: () => {
                this.mutating.set(p.userName);
                this.meetingService
                    .removeParticipant(this.meeting().id, p.userName)
                    .pipe(takeUntilDestroyed(this.destroyRef))
                    .subscribe({
                        next: () => {
                            this.mutating.set(null);
                            const detail: MeetingDetailDto = {
                                ...this.meeting(),
                                participants: this.meeting().participants.filter(
                                    (x) => x.userName !== p.userName
                                ),
                            };
                            this.changed.emit(detail);
                        },
                        error: () => this.mutating.set(null),
                    });
            },
        });
    }

    roleLabel(role: number): string {
        const map: Record<number, string> = {
            [MeetingParticipantRole.Host]: 'Chủ trì',
            [MeetingParticipantRole.CoHost]: 'Đồng chủ trì',
            [MeetingParticipantRole.Secretary]: 'Thư ký',
            [MeetingParticipantRole.Required]: 'Người tham gia',
            [MeetingParticipantRole.Optional]: 'Người tham gia',
        };
        return map[role] ?? '';
    }

    initials(name: string): string {
        const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
        if (parts.length === 0) return '?';
        const first = parts[0][0] ?? '';
        const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
        return (first + last).toUpperCase();
    }
}

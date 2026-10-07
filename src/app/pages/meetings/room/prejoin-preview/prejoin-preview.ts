import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    OnDestroy,
    OnInit,
    computed,
    input,
    model,
    output,
    signal,
    viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ROOM_I18N, RoomKey, RoomLang } from '../room-i18n';
import { SelectA11yDirective } from '../../../../shared/a11y/select-a11y.directive';

export interface PrejoinDevices {
    audioInput?: string; // label thiết bị (Jitsi chọn theo label)
    videoInput?: string;
    audioOutput?: string;
}

/**
 * Phòng chờ: xem trước camera, đo mức micro, chọn thiết bị (UI-07, F-13).
 * Chỉ dùng getUserMedia cục bộ — luồng media được dừng khi rời phòng chờ.
 * Trạng thái bật/tắt mic/cam được truyền lại cho phòng họp (two-way `audioMuted` / `videoMuted`).
 */
@Component({
    selector: 'app-prejoin-preview',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [FormsModule, NzIconModule, NzSelectModule, SelectA11yDirective],
    templateUrl: './prejoin-preview.html',
    styleUrl: './prejoin-preview.scss',
})
export class PrejoinPreview implements OnInit, OnDestroy {
    readonly lang = input<RoomLang>('vi');
    readonly displayName = input<string>('');
    readonly audioMuted = model<boolean>(true);
    readonly videoMuted = model<boolean>(true);
    readonly devicesChange = output<PrejoinDevices>();

    private readonly videoEl = viewChild<ElementRef<HTMLVideoElement>>('preview');

    readonly cams = signal<MediaDeviceInfo[]>([]);
    readonly mics = signal<MediaDeviceInfo[]>([]);
    readonly speakers = signal<MediaDeviceInfo[]>([]);
    readonly camId = signal<string>('');
    readonly micId = signal<string>('');
    readonly speakerId = signal<string>('');
    readonly level = signal<number>(0); // 0..1
    readonly status = signal<'idle' | 'loading' | 'ready' | 'denied' | 'unsupported'>('idle');
    readonly initials = computed(() =>
        (this.displayName() || '?')
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .map((w, i, a) => (i === 0 || i === a.length - 1 ? w[0] : ''))
            .join('')
            .toUpperCase(),
    );
    readonly levelPct = computed(() => Math.round(this.level() * 100));
    readonly levelBars = computed(() => {
        const lit = Math.round(this.level() * 10);
        return Array.from({ length: 10 }, (_, i) => i < lit);
    });

    private stream: MediaStream | null = null;
    private audioCtx: AudioContext | null = null;
    private raf = 0;

    t(key: RoomKey): string {
        return ROOM_I18N[this.lang()][key];
    }

    async ngOnInit(): Promise<void> {
        if (!navigator.mediaDevices?.getUserMedia) {
            this.status.set('unsupported');
            return;
        }
        await this.open();
        navigator.mediaDevices.addEventListener?.('devicechange', this.onDeviceChange);
    }

    ngOnDestroy(): void {
        navigator.mediaDevices?.removeEventListener?.('devicechange', this.onDeviceChange);
        this.stop();
    }

    toggleMic(): void {
        this.audioMuted.update((v) => !v);
        this.applyTrackState();
    }

    async toggleCam(): Promise<void> {
        this.videoMuted.update((v) => !v);
        if (!this.videoMuted() && !this.stream?.getVideoTracks().length) await this.open();
        this.applyTrackState();
    }

    async selectCam(id: string): Promise<void> {
        this.camId.set(id);
        await this.open();
    }

    async selectMic(id: string): Promise<void> {
        this.micId.set(id);
        await this.open();
    }

    selectSpeaker(id: string): void {
        this.speakerId.set(id);
        this.emitDevices();
    }

    private readonly onDeviceChange = () => void this.listDevices();

    private async open(): Promise<void> {
        this.stop();
        this.status.set('loading');
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: this.camId() ? { deviceId: { exact: this.camId() } } : true,
                audio: this.micId() ? { deviceId: { exact: this.micId() } } : true,
            });
        } catch {
            // Thử riêng micro nếu không có camera
            try {
                this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch {
                this.status.set('denied');
                return;
            }
        }
        this.status.set('ready');
        const video = this.videoEl()?.nativeElement;
        if (video) {
            video.srcObject = this.stream;
            void video.play().catch(() => undefined);
        }
        this.applyTrackState();
        this.startMeter();
        await this.listDevices();
    }

    private async listDevices(): Promise<void> {
        const all = await navigator.mediaDevices.enumerateDevices();
        this.cams.set(all.filter((d) => d.kind === 'videoinput'));
        this.mics.set(all.filter((d) => d.kind === 'audioinput'));
        this.speakers.set(all.filter((d) => d.kind === 'audiooutput'));
        const v = this.stream?.getVideoTracks()[0]?.getSettings().deviceId;
        const a = this.stream?.getAudioTracks()[0]?.getSettings().deviceId;
        if (v && !this.camId()) this.camId.set(v);
        if (a && !this.micId()) this.micId.set(a);
        this.emitDevices();
    }

    private emitDevices(): void {
        const label = (list: MediaDeviceInfo[], id: string) => list.find((d) => d.deviceId === id)?.label || undefined;
        this.devicesChange.emit({
            videoInput: label(this.cams(), this.camId()),
            audioInput: label(this.mics(), this.micId()),
            audioOutput: label(this.speakers(), this.speakerId()),
        });
    }

    private applyTrackState(): void {
        this.stream?.getAudioTracks().forEach((t) => (t.enabled = !this.audioMuted()));
        this.stream?.getVideoTracks().forEach((t) => (t.enabled = !this.videoMuted()));
    }

    private startMeter(): void {
        const track = this.stream?.getAudioTracks()[0];
        if (!track || typeof AudioContext === 'undefined') return;
        this.audioCtx = new AudioContext();
        const analyser = this.audioCtx.createAnalyser();
        analyser.fftSize = 512;
        this.audioCtx.createMediaStreamSource(new MediaStream([track])).connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        const tick = () => {
            analyser.getByteTimeDomainData(data);
            let peak = 0;
            for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
            this.level.set(this.audioMuted() ? 0 : Math.min(1, (peak / 128) * 2.2));
            this.raf = requestAnimationFrame(tick);
        };
        tick();
    }

    private stop(): void {
        cancelAnimationFrame(this.raf);
        void this.audioCtx?.close().catch(() => undefined);
        this.audioCtx = null;
        this.stream?.getTracks().forEach((t) => t.stop());
        this.stream = null;
        this.level.set(0);
    }
}

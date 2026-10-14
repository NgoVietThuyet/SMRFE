import { Component, ElementRef, EventEmitter, Input, OnDestroy, OnInit, Output, ViewChild } from '@angular/core';
import { SharedModules } from '../../../../../shared/ng-zorro.module';

export interface PrejoinChoice {
  audioMuted: boolean;
  videoMuted: boolean;
  /** Jitsi khớp thiết bị theo label. */
  devices: { audioInput?: string; videoInput?: string; audioOutput?: string };
}

/**
 * Màn chuẩn bị (mẫu meeting/components/waiting-room của 2.FrontEnd): xem trước camera, chọn mic/camera/loa,
 * bật/tắt mic, camera trước khi vào. Tắt luồng xem trước trước khi Jitsi mở thiết bị.
 */
@Component({
  selector: 'app-room-prejoin',
  standalone: true,
  imports: [SharedModules],
  templateUrl: './prejoin.html',
  styleUrl: './prejoin.scss',
})
export class RoomPrejoin implements OnInit, OnDestroy {
  @Input() displayName = '';
  @Input() busy = false;
  @Output() choice = new EventEmitter<PrejoinChoice>();
  @ViewChild('video', { static: true }) videoRef!: ElementRef<HTMLVideoElement>;

  audioMuted = false;
  videoMuted = false;
  mics: MediaDeviceInfo[] = [];
  cams: MediaDeviceInfo[] = [];
  speakers: MediaDeviceInfo[] = [];
  micId: string | null = null;
  camId: string | null = null;
  speakerId: string | null = null;
  error = '';
  level = 0;

  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private raf = 0;

  async ngOnInit(): Promise<void> {
    await this.open();
    await this.listDevices();
    navigator.mediaDevices?.addEventListener?.('devicechange', this.listDevices);
  }

  ngOnDestroy(): void {
    navigator.mediaDevices?.removeEventListener?.('devicechange', this.listDevices);
    this.close();
  }

  private listDevices = async (): Promise<void> => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      this.mics = all.filter(d => d.kind === 'audioinput' && d.deviceId);
      this.cams = all.filter(d => d.kind === 'videoinput' && d.deviceId);
      this.speakers = all.filter(d => d.kind === 'audiooutput' && d.deviceId);
      this.micId ??= this.stream?.getAudioTracks()[0]?.getSettings().deviceId ?? this.mics[0]?.deviceId ?? null;
      this.camId ??= this.stream?.getVideoTracks()[0]?.getSettings().deviceId ?? this.cams[0]?.deviceId ?? null;
      this.speakerId ??= this.speakers[0]?.deviceId ?? null;
    } catch { /* trình duyệt không hỗ trợ */ }
  };

  async open(): Promise<void> {
    this.close();
    this.error = '';
    if (!navigator.mediaDevices?.getUserMedia) {
      this.error = 'Trình duyệt không hỗ trợ camera/micro (cần HTTPS hoặc localhost).';
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: this.micId ? { deviceId: { exact: this.micId } } : true,
        video: this.camId ? { deviceId: { exact: this.camId } } : true,
      });
    } catch {
      // Không có camera → thử chỉ micro.
      try {
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        this.videoMuted = true;
        this.error = 'Không mở được camera. Bạn vẫn vào họp bằng micro được.';
      } catch {
        this.error = 'Chưa được cấp quyền camera/micro. Bạn vẫn vào phòng được nhưng sẽ tắt cả hai.';
        this.audioMuted = this.videoMuted = true;
        return;
      }
    }
    this.videoRef.nativeElement.srcObject = this.stream;
    this.applyMute();
    this.meter();
  }

  private meter(): void {
    const track = this.stream?.getAudioTracks()[0];
    if (!track || typeof AudioContext === 'undefined') return;
    this.audioCtx = new AudioContext();
    const analyser = this.audioCtx.createAnalyser();
    analyser.fftSize = 256;
    this.audioCtx.createMediaStreamSource(new MediaStream([track])).connect(analyser);
    const data = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteFrequencyData(data);
      const avg = data.reduce((a, b) => a + b, 0) / data.length;
      this.level = this.audioMuted ? 0 : Math.min(100, Math.round(avg * 1.6));
      this.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  private applyMute(): void {
    this.stream?.getAudioTracks().forEach(t => t.enabled = !this.audioMuted);
    this.stream?.getVideoTracks().forEach(t => t.enabled = !this.videoMuted);
  }

  toggleAudio(): void {
    this.audioMuted = !this.audioMuted;
    this.applyMute();
  }

  toggleVideo(): void {
    this.videoMuted = !this.videoMuted;
    this.applyMute();
  }

  close(): void {
    cancelAnimationFrame(this.raf);
    this.audioCtx?.close().catch(() => { });
    this.audioCtx = null;
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
  }

  join(): void {
    const label = (list: MediaDeviceInfo[], id: string | null) => list.find(d => d.deviceId === id)?.label || undefined;
    const devices = {
      audioInput: label(this.mics, this.micId),
      videoInput: label(this.cams, this.camId),
      audioOutput: label(this.speakers, this.speakerId),
    };
    this.close();
    this.choice.emit({ audioMuted: this.audioMuted, videoMuted: this.videoMuted, devices });
  }

  get initials(): string {
    const parts = (this.displayName || '?').trim().split(/\s+/);
    return parts[parts.length - 1].charAt(0).toUpperCase();
  }
}

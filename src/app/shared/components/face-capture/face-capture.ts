import {
  AfterViewInit, Component, ElementRef, EventEmitter, Input, NgZone, OnDestroy, Output, ViewChild,
} from '@angular/core';
import { SharedModules } from '../../ng-zorro.module';

export type FaceGesture = 'BLINK' | 'TURN_LEFT' | 'TURN_RIGHT';
type Pose = 'straight' | 'turn' | 'turnBack' | 'blink';
interface Step { pose: Pose; capture: number; hint: string; strictTurn?: boolean }

/** Mô hình và wasm MediaPipe nằm trong public/mediapipe (xem face-service/README.md). */
export const FACE_MODEL_URL = '/mediapipe/face_landmarker.task';
export const FACE_WASM_URL = '/mediapipe/wasm';

const HOLD_FRAMES = 4;          // số khung liên tiếp nhìn thẳng mới tính
const HOLD_TURN = 3;            // số khung liên tiếp khi đang nghiêng đầu
const CAPTURE_GAP_MS = 350;     // khoảng cách giữa hai ảnh chụp
const MIN_FACE_WIDTH = 0.28;    // mặt chiếm ≥ 28% bề rộng khung
const STRAIGHT_DELTA = 0.07;    // |tỉ lệ mũi − 0,5| nhỏ hơn mức này là nhìn thẳng
const TURN_DELTA = 0.1;         // quay đầu đủ để tính là cử chỉ (khi đăng nhập)
const TURN_MAX_VERIFY = 0.45;   // cử chỉ đăng nhập: quay bao nhiêu cũng được
const ENROLL_TURN_MIN = 0.07;   // lúc đăng ký chỉ cần nghiêng nhẹ (~13°)
const ENROLL_TURN_MAX = 0.32;   // không quay quá (~45°) để đặc trưng vẫn giống ảnh nhìn thẳng

/**
 * Chụp khuôn mặt bằng camera + MediaPipe Face Landmarker (chạy trong trình duyệt): kiểm tra một mặt, đủ to, đủ sáng,
 * yêu cầu cử chỉ (chống ảnh tĩnh), rồi chụp vài khung JPEG gửi lên máy chủ. MediaPipe chỉ để hướng dẫn và kiểm tra
 * chất lượng; quyết định nhận dạng nằm ở máy chủ.
 *  - mode 'verify': nhìn thẳng → làm cử chỉ {gesture} → chụp 3 ảnh nhìn thẳng.
 *  - mode 'enroll': 2 ảnh nhìn thẳng, 1 ảnh nghiêng trái nhẹ, 1 ảnh nghiêng phải nhẹ.
 */
@Component({
  selector: 'app-face-capture',
  standalone: true,
  imports: [SharedModules],
  template: `
    <div class="fc">
      <div class="stage">
        <video #video autoplay playsinline muted></video>
        <div class="oval" [class.ok]="faceOk"></div>
        @if (loading) { <div class="cover"><nz-spin nzSimple></nz-spin><span>Đang mở camera…</span></div> }
      </div>
      <div class="hint" [class.err]="!!error">{{ error || hint }}</div>
      <div class="bar"><div class="fill" [style.width.%]="progress"></div></div>
      @if (error) { <button nz-button nzType="primary" class="retry" (click)="restart()">Thử lại</button> }
    </div>
  `,
  styles: [`
    .fc { display: flex; flex-direction: column; align-items: center; gap: 10px; }
    .stage { position: relative; width: 100%; max-width: 360px; aspect-ratio: 4 / 3; background: #000; border-radius: 12px; overflow: hidden; }
    video { width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
    .oval { position: absolute; inset: 8% 24%; border: 3px dashed rgba(255, 255, 255, .85); border-radius: 50%; transition: border-color .2s; pointer-events: none; }
    .oval.ok { border-style: solid; border-color: #52c41a; }
    .cover { position: absolute; inset: 0; display: flex; flex-direction: column; gap: 8px; align-items: center; justify-content: center; color: #fff; background: rgba(0, 0, 0, .55); }
    .hint { min-height: 22px; text-align: center; font-weight: 500; }
    .hint.err { color: #cf1322; }
    .bar { width: 100%; max-width: 360px; height: 6px; border-radius: 3px; background: #f0f0f0; overflow: hidden; }
    .fill { height: 100%; background: #1677ff; transition: width .2s; }
    .retry { margin-top: 4px; }
  `],
})
export class FaceCapture implements AfterViewInit, OnDestroy {
  @Input() mode: 'verify' | 'enroll' = 'verify';
  @Input() gesture: FaceGesture | null = null;
  @Output() captured = new EventEmitter<string[]>();
  @Output() failed = new EventEmitter<string>();

  @ViewChild('video', { static: true }) videoRef!: ElementRef<HTMLVideoElement>;

  loading = true;
  hint = '';
  error = '';
  faceOk = false;
  progress = 0;

  private landmarker: any = null;
  private stream: MediaStream | null = null;
  private raf = 0;
  private alive = false;
  private lastVideoTime = -1;
  private steps: Step[] = [];
  private stepIndex = 0;
  private okFrames = 0;
  private blinkSeenOpen = false;
  private blinkSeenClosed = false;
  private frames: string[] = [];
  private stepFrames = 0;
  private lastCaptureAt = 0;
  private totalToCapture = 0;
  private brightness = 128;
  private frameCounter = 0;
  private lumaCanvas = document.createElement('canvas');

  constructor(private zone: NgZone) { }

  ngAfterViewInit(): void {
    void this.start();
  }

  ngOnDestroy(): void {
    this.stop();
  }

  restart(): void {
    this.stop();
    void this.start();
  }

  private buildSteps(): Step[] {
    if (this.mode === 'enroll') {
      return [
        { pose: 'straight', capture: 1, hint: 'Nhìn thẳng vào camera, giữ yên' },
        // Không phụ thuộc hướng trái/phải: nghiêng về một bên, rồi sang bên ngược lại.
        { pose: 'turn', capture: 1, hint: 'Nghiêng đầu nhẹ sang một bên', strictTurn: true },
        { pose: 'turnBack', capture: 1, hint: 'Giờ nghiêng đầu nhẹ sang bên kia', strictTurn: true },
      ];
    }
    const g = this.gesture;
    const gestureStep: Step = g === 'BLINK'
      ? { pose: 'blink', capture: 0, hint: 'Hãy chớp mắt một lần' }
      : { pose: 'turn', capture: 0, hint: 'Hãy quay đầu sang một bên rồi quay lại nhìn thẳng' };
    return [
      { pose: 'straight', capture: 0, hint: 'Nhìn thẳng vào camera, giữ yên' },
      gestureStep,
      { pose: 'straight', capture: 2, hint: 'Nhìn thẳng vào camera, giữ yên' },
    ];
  }

  private async start(): Promise<void> {
    this.error = '';
    this.loading = true;
    this.frames = [];
    this.stepIndex = 0;
    this.stepFrames = 0;
    this.okFrames = 0;
    this.blinkSeenOpen = this.blinkSeenClosed = this.reopened = false;
    this.firstTurnSign = 0;
    this.progress = 0;
    this.steps = this.buildSteps();
    this.totalToCapture = this.steps.reduce((n, s) => n + s.capture, 0);
    this.hint = 'Đang khởi động…';

    if (!navigator.mediaDevices?.getUserMedia) {
      return this.fail('Trình duyệt không hỗ trợ camera (cần HTTPS hoặc localhost).');
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false,
      });
    } catch {
      return this.fail('Chưa được cấp quyền camera. Hãy cho phép camera rồi thử lại.');
    }
    const video = this.videoRef.nativeElement;
    video.srcObject = this.stream;
    try { await video.play(); } catch { /* autoplay đã bật */ }

    try {
      const { FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      const fileset = await FilesetResolver.forVisionTasks(FACE_WASM_URL);
      const make = (delegate: 'GPU' | 'CPU') => FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: FACE_MODEL_URL, delegate },
        runningMode: 'VIDEO',
        numFaces: 2,
        outputFaceBlendshapes: true,
      });
      try { this.landmarker = await make('GPU'); } catch { this.landmarker = await make('CPU'); }
    } catch {
      return this.fail('Không tải được mô hình nhận diện khuôn mặt. Hãy kiểm tra mạng và thử lại.');
    }

    this.alive = true;
    this.loading = false;
    this.hint = this.steps[0].hint;
    this.zone.runOutsideAngular(() => this.loop());
  }

  private stop(): void {
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach(t => t.stop());
    this.stream = null;
    try { this.landmarker?.close(); } catch { /* đã đóng */ }
    this.landmarker = null;
  }

  private fail(message: string): void {
    this.stop();
    this.zone.run(() => {
      this.loading = false;
      this.error = message;
      this.faceOk = false;
    });
    this.failed.emit(message);
  }

  private loop(): void {
    if (!this.alive) return;
    this.raf = requestAnimationFrame(() => this.loop());
    const video = this.videoRef.nativeElement;
    if (video.readyState < 2 || video.currentTime === this.lastVideoTime || !this.landmarker) return;
    this.lastVideoTime = video.currentTime;
    this.frameCounter++;
    if (this.frameCounter % 8 === 1) this.measureBrightness(video);
    let result: any;
    try { result = this.landmarker.detectForVideo(video, performance.now()); } catch { return; }
    this.evaluate(result, video);
  }

  private measureBrightness(video: HTMLVideoElement): void {
    const c = this.lumaCanvas;
    c.width = 64;
    c.height = 48;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, 64, 48);
    const d = ctx.getImageData(0, 0, 64, 48).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    this.brightness = sum / (d.length / 4);
  }

  private blend(result: any, name: string): number {
    const cats = result?.faceBlendshapes?.[0]?.categories ?? [];
    return cats.find((c: any) => c.categoryName === name)?.score ?? 0;
  }

  private evaluate(result: any, video: HTMLVideoElement): void {
    const faces: any[] = result?.faceLandmarks ?? [];
    let problem = '';
    let ratio = 0.5;
    if (faces.length === 0) problem = 'Chưa thấy khuôn mặt. Hãy đưa mặt vào giữa khung hình.';
    else if (faces.length > 1) problem = 'Chỉ một người trong khung hình.';
    else {
      const lm = faces[0];
      const xs = lm.map((p: any) => p.x);
      const ys = lm.map((p: any) => p.y);
      const w = Math.max(...xs) - Math.min(...xs);
      const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
      const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
      const lx = Math.min(lm[234].x, lm[454].x);
      const rx = Math.max(lm[234].x, lm[454].x);
      // >0,5: mũi lệch về bên phải của ảnh gốc = người dùng quay sang TRÁI của họ (ảnh gốc chưa lật gương).
      ratio = rx > lx ? (lm[1].x - lx) / (rx - lx) : 0.5;
      if (w < MIN_FACE_WIDTH) problem = 'Hãy đưa mặt lại gần camera hơn.';
      else if (Math.abs(cx - 0.5) > 0.2 || Math.abs(cy - 0.5) > 0.22) problem = 'Hãy đưa mặt vào giữa khung hình.';
      else if (this.brightness < 55) problem = 'Quá tối. Hãy ra chỗ sáng hơn.';
      else if (this.brightness > 220) problem = 'Quá sáng hoặc ngược sáng. Hãy xoay người cho đỡ chói.';
    }

    const step = this.steps[this.stepIndex];
    const okPose = !problem && this.poseOk(step, ratio, result);
    this.setStatus(!problem, problem || (okPose ? step.hint : this.poseHint(step, ratio - 0.5)));
    this.okFrames = okPose ? this.okFrames + 1 : 0;
    if (step.pose === 'blink') {
      // Cử chỉ chớp mắt: mở → nhắm → mở lại (poseOk cập nhật các cờ). Phải thấy mở mắt trước rồi mới nhắm.
      if (this.reopened) this.nextStep();
      return;
    }
    if (this.okFrames < (step.pose === 'straight' ? HOLD_FRAMES : HOLD_TURN)) return;

    if (step.capture === 0) {
      this.nextStep();
      return;
    }
    const now = performance.now();
    if (now - this.lastCaptureAt < CAPTURE_GAP_MS) return;
    this.lastCaptureAt = now;
    this.frames.push(this.snapshot(video));
    this.stepFrames++;
    this.setProgress();
    if (this.stepFrames >= step.capture) this.nextStep();
  }

  private reopened = false;
  private firstTurnSign = 0;

  private turnMin(step: Step): number { return step.strictTurn ? ENROLL_TURN_MIN : TURN_DELTA; }
  private turnMax(step: Step): number { return step.strictTurn ? ENROLL_TURN_MAX : TURN_MAX_VERIFY; }

  /** Gợi ý theo tình trạng hiện tại (nghiêng thiếu, quá, hay sai bên). */
  private poseHint(step: Step, delta: number): string {
    if (step.pose === 'turn' || step.pose === 'turnBack') {
      const a = Math.abs(delta);
      if (a > this.turnMax(step)) return 'Quay lại một chút, chỉ cần nghiêng nhẹ';
      if (step.pose === 'turnBack' && this.firstTurnSign !== 0 && delta * this.firstTurnSign >= 0 && a >= this.turnMin(step)) {
        return 'Nghiêng sang bên ngược lại';
      }
    }
    return step.hint;
  }

  private poseOk(step: Step, ratio: number, result: any): boolean {
    const delta = ratio - 0.5; // >0: quay sang trái của người dùng
    switch (step.pose) {
      case 'straight':
        return Math.abs(delta) < STRAIGHT_DELTA;
      case 'turn': {
        const a = Math.abs(delta);
        const ok = a >= this.turnMin(step) && a <= this.turnMax(step);
        if (ok && this.firstTurnSign === 0) this.firstTurnSign = Math.sign(delta);
        return ok;
      }
      case 'turnBack': {
        // Bên ngược với lần nghiêng đầu tiên.
        const a = Math.abs(delta);
        return this.firstTurnSign !== 0 && delta * this.firstTurnSign < 0 && a >= this.turnMin(step) && a <= this.turnMax(step);
      }
      case 'blink': {
        const eyes = Math.min(this.blend(result, 'eyeBlinkLeft'), this.blend(result, 'eyeBlinkRight'));
        if (eyes < 0.3) {
          if (this.blinkSeenClosed) this.reopened = true; else this.blinkSeenOpen = true;
        } else if (eyes > 0.5 && this.blinkSeenOpen) {
          this.blinkSeenClosed = true;
        }
        return true;
      }
    }
  }

  private nextStep(): void {
    this.stepIndex++;
    this.stepFrames = 0;
    this.okFrames = 0;
    this.blinkSeenOpen = this.blinkSeenClosed = this.reopened = false;
    if (this.stepIndex >= this.steps.length) {
      const frames = this.frames.slice();
      this.stop();
      this.zone.run(() => {
        this.progress = 100;
        this.hint = 'Đã chụp xong, đang xác thực…';
        this.faceOk = true;
      });
      this.captured.emit(frames);
      return;
    }
    this.setStatus(true, this.steps[this.stepIndex].hint);
  }

  private setProgress(): void {
    const p = this.totalToCapture ? Math.round((this.frames.length / this.totalToCapture) * 100) : 0;
    this.zone.run(() => this.progress = Math.min(p, 99));
  }

  private setStatus(faceOk: boolean, hint: string): void {
    if (faceOk === this.faceOk && hint === this.hint) return;
    this.zone.run(() => {
      this.faceOk = faceOk;
      this.hint = hint;
    });
  }

  /** Chụp khung hiện tại thành JPEG (cạnh dài tối đa 640 px). */
  private snapshot(video: HTMLVideoElement): string {
    const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(video.videoWidth * scale);
    c.height = Math.round(video.videoHeight * scale);
    c.getContext('2d')!.drawImage(video, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.85);
  }
}

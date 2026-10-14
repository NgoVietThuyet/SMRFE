import {
  AfterViewInit, Component, ElementRef, EventEmitter, HostListener, Input, OnDestroy, OnInit, Output, ViewChild,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject, filter, takeUntil } from 'rxjs';
import { NzMessageService } from 'ng-zorro-antd/message';
import { SharedModules } from '../../../../../shared/ng-zorro.module';
import { RealtimeHubService } from '../../../../../shared/services';
import { RoomService } from '../../../services/room.service';
import { MeetingService } from '../../../services/meeting.service';
import { WhiteboardState } from '../../../models/room.models';

type Tool = 'pen' | 'marker' | 'eraser' | 'line' | 'rect' | 'ellipse';

/** Một nét vẽ. pts = [x0, y0, x1, y1, ...] chuẩn hoá 0..1 theo khung 16:9; size theo phần nghìn chiều rộng. */
interface Stroke {
  id: string;
  by: string;
  tool: Tool;
  color: string;
  size: number;
  pts: number[];
}

/** Gói tin realtime: p = đang vẽ (nối thêm điểm), d = xong nét, u = bỏ nét, c = xoá bảng. */
type WbOp =
  | { k: 'p'; id: string; tool: Tool; color: string; size: number; pts: number[] }
  | { k: 'd'; stroke: Stroke }
  | { k: 'u'; id: string }
  | { k: 'c' };

const RATIO = 16 / 9;
const BG = '#ffffff';
const SEND_EVERY_MS = 80;
const SAVE_DEBOUNCE_MS = 800;

/**
 * Bảng trắng phòng họp (P10). Canvas 2D thuần (lấy ý tưởng từ FE/.../room/components/whiteboard).
 * Đồng bộ: nét đang vẽ gửi qua hub SendWhiteboardOp mỗi ~80ms (người khác thấy gần như ngay);
 * nội dung bền lưu qua PUT room/whiteboard với Revision — lệch Revision (409) thì gộp theo id nét rồi lưu lại.
 */
@Component({
  selector: 'app-room-whiteboard',
  standalone: true,
  imports: [SharedModules],
  templateUrl: './whiteboard.html',
  styleUrl: './whiteboard.scss',
})
export class RoomWhiteboard implements OnInit, AfterViewInit, OnDestroy {
  @Input({ required: true }) meetingId = '';
  @Input() userName = '';
  @Input() isModerator = false;
  @Output() closed = new EventEmitter<void>();

  @ViewChild('stage', { static: true }) stageRef!: ElementRef<HTMLElement>;
  @ViewChild('canvas', { static: true }) canvasRef!: ElementRef<HTMLCanvasElement>;

  private destroy$ = new Subject<void>();
  readonly palette = ['#0f172a', '#1677ff', '#f5222d', '#fa8c16', '#52c41a', '#722ed1'];
  readonly sizes = [{ v: 3, label: 'Mảnh' }, { v: 6, label: 'Vừa' }, { v: 12, label: 'Đậm' }];

  tool: Tool = 'pen';
  color = '#1677ff';
  size = 3;
  locked = false;
  loading = true;
  savingPng = false;

  private strokes: Stroke[] = [];
  /** Nét người khác đang vẽ dở. */
  private remote = new Map<string, Stroke>();
  private current: Stroke | null = null;
  private pendingPts: number[] = [];
  private lastSend = 0;

  private revision = 0;
  private dirty = false;
  private saving = false;
  /** Nét mình đã bỏ (undo) từ lần lưu trước — để khi gộp không "hồi sinh" lại. */
  private removedIds = new Set<string>();
  private clearedSinceSave = false;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  private ctx: CanvasRenderingContext2D | null = null;
  private box = { x: 0, y: 0, w: 1, h: 1 };
  private dpr = 1;

  constructor(
    private hub: RealtimeHubService,
    private room: RoomService,
    private meetings: MeetingService,
    private message: NzMessageService,
  ) { }

  get canDraw(): boolean {
    return !this.locked || this.isModerator;
  }

  ngOnInit(): void {
    this.hub.roomEvent
      .pipe(filter(e => e.payload?.meetingId === this.meetingId), takeUntil(this.destroy$))
      .subscribe(e => {
        if (e.name === 'WhiteboardOp' && e.payload.by !== this.userName) this.applyOp(e.payload.op as WbOp);
        if (e.name === 'WhiteboardSaved' && e.payload.by !== this.userName && e.payload.revision > this.revision) this.reload();
        if (e.name === 'WhiteboardLockChanged') this.locked = !!e.payload.locked;
      });
    this.reload();
  }

  ngAfterViewInit(): void {
    queueMicrotask(() => this.resize());
  }

  ngOnDestroy(): void {
    if (this.dirty) this.flushSave();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ===================== Nạp / lưu =====================

  private reload(): void {
    this.room.whiteboard(this.meetingId).pipe(takeUntil(this.destroy$)).subscribe({
      next: state => {
        this.apply(state, true);
        this.loading = false;
      },
      error: () => this.loading = false,
    });
  }

  /** Nạp bản trên server; merge = giữ lại nét của mình chưa kịp lưu. */
  private apply(state: WhiteboardState, merge: boolean): void {
    const server = this.parse(state.contentJson);
    this.revision = state.revision;
    this.locked = state.isLocked;
    if (merge && this.dirty) {
      this.strokes = this.clearedSinceSave ? this.mineUnsaved(server) : this.union(server, this.strokes);
    } else {
      this.strokes = server;
    }
    this.redraw();
  }

  private parse(json: string): Stroke[] {
    try {
      const data = JSON.parse(json || '[]');
      const list = Array.isArray(data) ? data : data?.strokes;
      return Array.isArray(list) ? list.filter((s: any) => s && s.id && Array.isArray(s.pts)) : [];
    } catch {
      return [];
    }
  }

  /** Gộp theo id: nét trên server + nét của mình chưa có trên server, bỏ các nét mình đã undo. */
  private union(server: Stroke[], local: Stroke[]): Stroke[] {
    const ids = new Set(server.map(s => s.id));
    return [...server, ...local.filter(s => !ids.has(s.id))].filter(s => !this.removedIds.has(s.id));
  }

  /** Sau khi mình xoá bảng: chỉ giữ nét vẽ sau thời điểm xoá (nét chưa có trên server). */
  private mineUnsaved(server: Stroke[]): Stroke[] {
    const ids = new Set(server.map(s => s.id));
    return this.strokes.filter(s => !ids.has(s.id));
  }

  private scheduleSave(): void {
    this.dirty = true;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flushSave(), SAVE_DEBOUNCE_MS);
  }

  private flushSave(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    if (this.saving || !this.dirty || !this.canDraw) return;
    this.saving = true;
    const snapshot = JSON.stringify({ v: 1, strokes: this.strokes });
    this.room.saveWhiteboard(this.meetingId, this.revision, snapshot).subscribe({
      next: state => {
        this.saving = false;
        this.revision = state.revision;
        // Có thay đổi mới trong lúc đang lưu → lưu tiếp.
        if (JSON.stringify({ v: 1, strokes: this.strokes }) === snapshot) {
          this.dirty = false;
          this.removedIds.clear();
          this.clearedSinceSave = false;
        } else {
          this.scheduleSave();
        }
      },
      error: (err: HttpErrorResponse) => {
        this.saving = false;
        if (err.status === 409 && err.error?.data) {
          // Người khác vừa lưu → gộp rồi lưu lại trên Revision mới.
          this.apply(err.error.data as WhiteboardState, true);
          this.scheduleSave();
        } else if (err.status === 403) {
          this.locked = true;
          this.message.warning(err.error?.message || 'Không thể lưu bảng trắng');
          this.reload();
          this.dirty = false;
        }
      },
    });
  }

  // ===================== Vẽ =====================

  @HostListener('window:resize')
  resize(): void {
    const stage = this.stageRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    this.dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(w * this.dpr);
    canvas.height = Math.floor(h * this.dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    // Khung 16:9 ở giữa — toạ độ chuẩn hoá theo khung này để mọi màn hình khớp nhau.
    const bw = Math.min(w - 16, (h - 16) * RATIO);
    const bh = bw / RATIO;
    this.box = { x: (w - bw) / 2, y: (h - bh) / 2, w: bw, h: bh };
    this.ctx = canvas.getContext('2d');
    this.redraw();
  }

  private norm(e: PointerEvent): [number, number] {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const x = (e.clientX - rect.left - this.box.x) / this.box.w;
    const y = (e.clientY - rect.top - this.box.y) / this.box.h;
    return [Math.min(1, Math.max(0, +x.toFixed(4))), Math.min(1, Math.max(0, +y.toFixed(4)))];
  }

  onDown(e: PointerEvent): void {
    if (!this.canDraw || this.loading) return;
    this.canvasRef.nativeElement.setPointerCapture(e.pointerId);
    const [x, y] = this.norm(e);
    this.current = {
      id: `${this.userName}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      by: this.userName,
      tool: this.tool,
      color: this.tool === 'eraser' ? BG : this.color,
      size: this.tool === 'eraser' ? Math.max(this.size * 4, 24) : this.tool === 'marker' ? this.size * 3 : this.size,
      pts: [x, y],
    };
    this.pendingPts = [x, y];
    this.lastSend = 0;
  }

  onMove(e: PointerEvent): void {
    if (!this.current) return;
    const [x, y] = this.norm(e);
    if (this.isShape(this.current.tool)) {
      this.current.pts = [this.current.pts[0], this.current.pts[1], x, y];
    } else {
      this.current.pts.push(x, y);
      this.pendingPts.push(x, y);
    }
    this.redraw();
    const now = Date.now();
    if (now - this.lastSend >= SEND_EVERY_MS) {
      this.lastSend = now;
      const c = this.current;
      const pts = this.isShape(c.tool) ? c.pts : this.pendingPts;
      this.send({ k: 'p', id: c.id, tool: c.tool, color: c.color, size: c.size, pts: [...pts] });
      this.pendingPts = [];
    }
  }

  onUp(): void {
    const c = this.current;
    if (!c) return;
    this.current = null;
    this.pendingPts = [];
    if (c.pts.length < 4) c.pts.push(c.pts[0] + 0.0005, c.pts[1]); // chấm 1 điểm
    this.strokes.push(c);
    this.send({ k: 'd', stroke: c });
    this.redraw();
    this.scheduleSave();
  }

  undo(): void {
    const mine = [...this.strokes].reverse().find(s => s.by === this.userName);
    if (!mine || !this.canDraw) return;
    this.strokes = this.strokes.filter(s => s !== mine);
    this.removedIds.add(mine.id);
    this.send({ k: 'u', id: mine.id });
    this.redraw();
    this.scheduleSave();
  }

  clear(): void {
    if (!this.isModerator) return;
    this.strokes.forEach(s => this.removedIds.add(s.id));
    this.strokes = [];
    this.clearedSinceSave = true;
    this.send({ k: 'c' });
    this.redraw();
    this.scheduleSave();
  }

  toggleLock(): void {
    if (!this.isModerator) return;
    this.room.lockWhiteboard(this.meetingId, !this.locked).subscribe(res => this.locked = !!res.data?.isLocked);
  }

  private send(op: WbOp): void {
    this.hub.sendWhiteboardOp(this.meetingId, op);
  }

  private applyOp(op: WbOp): void {
    switch (op?.k) {
      case 'p': {
        const s = this.remote.get(op.id) ?? { id: op.id, by: '', tool: op.tool, color: op.color, size: op.size, pts: [] };
        s.pts = this.isShape(op.tool) ? op.pts : [...s.pts, ...op.pts];
        this.remote.set(op.id, s);
        break;
      }
      case 'd':
        this.remote.delete(op.stroke.id);
        if (!this.strokes.some(s => s.id === op.stroke.id)) this.strokes.push(op.stroke);
        break;
      case 'u':
        this.strokes = this.strokes.filter(s => s.id !== op.id);
        break;
      case 'c':
        this.strokes = [];
        this.remote.clear();
        break;
    }
    this.redraw();
  }

  private isShape(tool: Tool): boolean {
    return tool === 'line' || tool === 'rect' || tool === 'ellipse';
  }

  private redraw(): void {
    const ctx = this.ctx;
    const canvas = this.canvasRef?.nativeElement;
    if (!ctx || !canvas) return;
    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = BG;
    ctx.fillRect(this.box.x, this.box.y, this.box.w, this.box.h);
    ctx.beginPath();
    ctx.rect(this.box.x, this.box.y, this.box.w, this.box.h);
    ctx.clip();
    for (const s of this.strokes) this.draw(ctx, s);
    for (const s of this.remote.values()) this.draw(ctx, s);
    if (this.current) this.draw(ctx, this.current);
    ctx.restore();
  }

  private draw(ctx: CanvasRenderingContext2D, s: Stroke): void {
    const { x: bx, y: by, w: bw, h: bh } = this.box;
    const px = (i: number) => bx + s.pts[i] * bw;
    const py = (i: number) => by + s.pts[i + 1] * bh;
    ctx.save();
    ctx.strokeStyle = s.color;
    ctx.lineWidth = Math.max(1, (s.size / 1000) * bw * 1.6);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = s.tool === 'marker' ? 0.35 : 1;
    ctx.beginPath();
    if (s.tool === 'rect' && s.pts.length >= 4) {
      ctx.strokeRect(px(0), py(0), px(2) - px(0), py(2) - py(0));
    } else if (s.tool === 'ellipse' && s.pts.length >= 4) {
      ctx.ellipse((px(0) + px(2)) / 2, (py(0) + py(2)) / 2, Math.abs(px(2) - px(0)) / 2, Math.abs(py(2) - py(0)) / 2, 0, 0, Math.PI * 2);
      ctx.stroke();
    } else if (s.pts.length >= 2) {
      ctx.moveTo(px(0), py(0));
      for (let i = 2; i < s.pts.length; i += 2) ctx.lineTo(px(i), py(i));
      ctx.stroke();
    }
    ctx.restore();
  }

  // ===================== Lưu ảnh vào tài liệu =====================

  savePng(): void {
    if (this.savingPng || !this.strokes.length) return;
    // Vẽ lại riêng khung 16:9 ra canvas tạm, độ phân giải cố định 1600x900.
    const out = document.createElement('canvas');
    out.width = 1600;
    out.height = 900;
    const ctx = out.getContext('2d')!;
    const saved = { box: this.box };
    this.box = { x: 0, y: 0, w: 1600, h: 900 };
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, 1600, 900);
    this.strokes.forEach(s => this.draw(ctx, s));
    this.box = saved.box;
    this.savingPng = true;
    out.toBlob(blob => {
      if (!blob) {
        this.savingPng = false;
        return;
      }
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, '0');
      const file = new File([blob], `Bang-trang-${p(d.getHours())}${p(d.getMinutes())}-${p(d.getDate())}${p(d.getMonth() + 1)}${d.getFullYear()}.png`, { type: 'image/png' });
      this.meetings.uploadFile(this.meetingId, file).subscribe({
        next: () => {
          this.savingPng = false;
          this.message.success('Đã lưu ảnh bảng trắng vào Tài liệu');
        },
        error: () => this.savingPng = false,
      });
    }, 'image/png');
  }
}

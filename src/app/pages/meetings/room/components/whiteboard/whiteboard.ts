import {
    Component,
    DestroyRef,
    ElementRef,
    HostListener,
    OnInit,
    inject,
    input,
    output,
    signal,
    viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { MeetingService } from '../../../../../core/services/meeting.service';
import { RoomKey, RoomLang, ROOM_I18N } from '../../room-i18n';

type Tool = 'pen' | 'highlighter' | 'eraser' | 'rect' | 'circle' | 'line' | 'text';

interface Stroke {
    points: { x: number; y: number }[];
    color: string;
    width: number;
    eraser: boolean;
    alpha: number;
}

interface Shape {
    kind: 'rect' | 'circle' | 'line' | 'text';
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    color: string;
    width: number;
    text?: string;
}

// =====================================================
// WhiteboardCanvas — bảng trắng vẽ thật bằng Canvas 2D
// thuần (không Excalidraw vì lib React-only). Pen/highlighter/
// tẩy/shapes/text + undo/redo + lưu PNG vào tài liệu họp.
// Vẽ lại toàn bộ từ state mỗi frame (đơn giản, đủ cho KLTN).
// =====================================================
@Component({
    selector: 'app-whiteboard',
    templateUrl: './whiteboard.html',
    styleUrl: './whiteboard.scss',
    imports: [
        CommonModule,
        FormsModule,
        NzButtonModule,
        NzIconModule,
        NzInputModule,
        NzInputNumberModule,
        NzSpinModule,
        NzTooltipModule,
    ],
})
export class WhiteboardCanvas implements OnInit {
    private readonly meetingService = inject(MeetingService);
    private readonly message = inject(NzMessageService);
    private readonly destroyRef = inject(DestroyRef);

    private readonly boardWrap = viewChild.required<ElementRef<HTMLElement>>('boardWrap');
    private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

    meetingId = input.required<string>();
    lang = input<RoomLang>('vi');
    saved = output<void>(); // lưu xong → room chuyển panel docs
    exited = output<void>();

    tool = signal<Tool>('pen');
    color = signal<string>('#2563eb');
    width = signal<number>(3);
    saving = signal<boolean>(false);
    textInput = signal<string>('');

    readonly palette = ['#0f172a', '#2563eb', '#dc2626', '#d97706', '#16a34a', '#7c3aed', '#ffffff'];

    private strokes: Stroke[] = [];
    private shapes: Shape[] = [];
    private redoStrokes: Stroke[] = [];
    private redoShapes: Shape[] = [];
    private drawing = false;
    private current: Stroke | null = null;
    private previewShape: Shape | null = null;
    private ctx: CanvasRenderingContext2D | null = null;
    private dpr = 1;

    t(key: RoomKey): string {
        return ROOM_I18N[this.lang()][key];
    }

    ngOnInit(): void {
        // Canvas cần DOM đã render — đợi 1 tick sau init
        queueMicrotask(() => this.setupCanvas());
    }

    @HostListener('window:resize')
    onResize(): void {
        this.setupCanvas();
    }

    private setupCanvas(): void {
        const canvas = this.canvasRef()?.nativeElement;
        const wrap = this.boardWrap()?.nativeElement;
        if (!canvas || !wrap) return;
        this.dpr = window.devicePixelRatio || 1;
        const w = wrap.clientWidth;
        const h = wrap.clientHeight;
        canvas.width = Math.max(1, Math.floor(w * this.dpr));
        canvas.height = Math.max(1, Math.floor(h * this.dpr));
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        this.ctx = canvas.getContext('2d');
        this.redraw();
    }

    private pos(event: PointerEvent): { x: number; y: number } {
        const rect = this.canvasRef().nativeElement.getBoundingClientRect();
        return { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }

    onPointerDown(event: PointerEvent): void {
        if (this.saving()) return;
        const p = this.pos(event);
        const tool = this.tool();
        this.canvasRef().nativeElement.setPointerCapture(event.pointerId);

        if (tool === 'text') {
            const text = this.textInput().trim();
            if (!text) return;
            this.shapes.push({
                kind: 'text', x0: p.x, y0: p.y, x1: p.x, y1: p.y,
                color: this.color(), width: this.width(), text,
            });
            this.redoShapes = [];
            this.textInput.set('');
            this.redraw();
            return;
        }
        if (tool === 'rect' || tool === 'circle' || tool === 'line') {
            this.previewShape = {
                kind: tool, x0: p.x, y0: p.y, x1: p.x, y1: p.y,
                color: this.color(), width: this.width(),
            };
            this.drawing = true;
            return;
        }
        // pen / highlighter / eraser
        this.drawing = true;
        this.current = {
            points: [p],
            color: tool === 'eraser' ? '#0b1220' : this.color(),
            width: tool === 'eraser' ? Math.max(this.width(), 12) : this.width(),
            eraser: tool === 'eraser',
            alpha: tool === 'highlighter' ? 0.35 : 1,
        };
    }

    onPointerMove(event: PointerEvent): void {
        if (!this.drawing) return;
        const p = this.pos(event);
        if (this.previewShape) {
            this.previewShape.x1 = p.x;
            this.previewShape.y1 = p.y;
            this.redraw();
            return;
        }
        if (this.current) {
            this.current.points.push(p);
            this.drawStroke(this.current);
        }
    }

    onPointerUp(): void {
        if (!this.drawing) return;
        this.drawing = false;
        if (this.previewShape) {
            this.shapes.push(this.previewShape);
            this.previewShape = null;
            this.redoShapes = [];
            this.redraw();
            return;
        }
        if (this.current) {
            this.strokes.push(this.current);
            this.current = null;
            this.redoStrokes = [];
            this.redraw();
        }
    }

    undo(): void {
        // Ưu tiên undo shape mới nhất, rồi đến stroke
        if (this.shapes.length > 0) {
            this.redoShapes.push(this.shapes.pop()!);
        } else if (this.strokes.length > 0) {
            this.redoStrokes.push(this.strokes.pop()!);
        } else {
            return;
        }
        this.redraw();
    }

    redo(): void {
        if (this.redoShapes.length > 0) {
            this.shapes.push(this.redoShapes.pop()!);
        } else if (this.redoStrokes.length > 0) {
            this.strokes.push(this.redoStrokes.pop()!);
        } else {
            return;
        }
        this.redraw();
    }

    clearAll(): void {
        this.strokes = [];
        this.shapes = [];
        this.redoStrokes = [];
        this.redoShapes = [];
        this.redraw();
    }

    private redraw(): void {
        const ctx = this.ctx;
        const canvas = this.canvasRef()?.nativeElement;
        if (!ctx || !canvas) return;
        ctx.save();
        ctx.scale(this.dpr, this.dpr);
        const w = canvas.width / this.dpr;
        const h = canvas.height / this.dpr;
        ctx.clearRect(0, 0, w, h);
        // Nền tối đồng bộ stage
        ctx.fillStyle = '#0b1220';
        ctx.fillRect(0, 0, w, h);
        for (const s of this.strokes) this.drawStroke(s);
        for (const sh of this.shapes) this.drawShape(sh);
        if (this.previewShape) this.drawShape(this.previewShape, true);
        ctx.restore();
    }

    private drawStroke(s: Stroke): void {
        const ctx = this.ctx;
        if (!ctx || s.points.length === 0) return;
        ctx.save();
        ctx.scale(this.dpr, this.dpr);
        ctx.globalAlpha = s.alpha;
        ctx.strokeStyle = s.color;
        ctx.lineWidth = s.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(s.points[0].x, s.points[0].y);
        for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
        ctx.stroke();
        ctx.restore();
    }

    private drawShape(sh: Shape, dashed = false): void {
        const ctx = this.ctx;
        if (!ctx) return;
        ctx.save();
        ctx.scale(this.dpr, this.dpr);
        ctx.strokeStyle = sh.color;
        ctx.fillStyle = sh.color;
        ctx.lineWidth = sh.width;
        ctx.lineCap = 'round';
        if (dashed) ctx.setLineDash([6, 4]);
        if (sh.kind === 'text') {
            ctx.font = `600 ${Math.max(14, sh.width * 5)}px var(--font-family, sans-serif)`;
            ctx.fillText(sh.text ?? '', sh.x0, sh.y0);
        } else if (sh.kind === 'rect') {
            ctx.strokeRect(sh.x0, sh.y0, sh.x1 - sh.x0, sh.y1 - sh.y0);
        } else if (sh.kind === 'circle') {
            const rx = Math.abs(sh.x1 - sh.x0) / 2;
            const ry = Math.abs(sh.y1 - sh.y0) / 2;
            ctx.beginPath();
            ctx.ellipse((sh.x0 + sh.x1) / 2, (sh.y0 + sh.y1) / 2, rx, ry, 0, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.beginPath();
            ctx.moveTo(sh.x0, sh.y0);
            ctx.lineTo(sh.x1, sh.y1);
            ctx.stroke();
        }
        ctx.restore();
    }

    saveToDocs(): void {
        if (this.saving() || (this.strokes.length === 0 && this.shapes.length === 0)) return;
        const canvas = this.canvasRef().nativeElement;
        this.saving.set(true);
        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    this.saving.set(false);
                    this.message.error(this.t('wbSaveFailed'));
                    return;
                }
                const now = new Date();
                const pad = (n: number) => n.toString().padStart(2, '0');
                const name = `Bang-trang-${pad(now.getHours())}${pad(now.getMinutes())}-${pad(now.getDate())}${pad(now.getMonth() + 1)}${now.getFullYear()}.png`;
                const file = new File([blob], name, { type: 'image/png' });
                this.meetingService
                    .uploadMeetingFile(this.meetingId(), file)
                    .pipe(takeUntilDestroyed(this.destroyRef))
                    .subscribe({
                        next: () => {
                            this.saving.set(false);
                            this.message.success(this.t('wbSaved'));
                            this.saved.emit();
                        },
                        error: (err: Error) => {
                            this.saving.set(false);
                            this.message.error(err.message || this.t('wbSaveFailed'));
                        },
                    });
            },
            'image/png'
        );
    }
}

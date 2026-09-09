import { useRef, useEffect, useState } from 'react';
import { PenTool, FileText, Eraser } from 'lucide-react';
import { PanelHeader } from '@/components/meeting/PanelHeader';
import { Button } from '@/components/ui/Button';
import { useLanguage } from '@/i18n';

interface WhiteboardPanelProps {
  onClose: () => void;
}

export function WhiteboardPanel({ onClose }: WhiteboardPanelProps) {
  const { t } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState('#3b82f6');
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineWidth = tool === 'eraser' ? 20 : 2;
    ctx.lineCap = 'round';
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const stopDraw = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#0f172a', '#06b6d4'];

  return (
    <>
      <PanelHeader title={t('panel.wb.title')} icon={PenTool} onClose={onClose} />
      <div role="toolbar" aria-label={t('panel.wb.tools')} className="px-4 py-2.5 border-b border-ink-100 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTool('pen')}
          aria-pressed={tool === 'pen'}
          aria-label={t('panel.wb.pen')}
          className={`min-w-[36px] min-h-[36px] inline-flex items-center justify-center p-1.5 rounded focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cta-500/40 ${tool === 'pen' ? 'bg-primary-100 text-primary-700' : 'text-ink-500 hover:bg-ink-100'}`}
        >
          <PenTool size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={() => setTool('eraser')}
          aria-pressed={tool === 'eraser'}
          aria-label={t('panel.wb.eraser')}
          className={`min-w-[36px] min-h-[36px] inline-flex items-center justify-center p-1.5 rounded focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cta-500/40 ${tool === 'eraser' ? 'bg-primary-100 text-primary-700' : 'text-ink-500 hover:bg-ink-100'}`}
        >
          <Eraser size={16} aria-hidden="true" />
        </button>
        <div aria-hidden="true" className="w-px h-5 bg-ink-200" />
        <div role="group" aria-label={t('panel.wb.colors')} className="flex items-center gap-1.5">
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => { setColor(c); setTool('pen'); }}
            aria-label={t('panel.wb.penColor', { c })}
            aria-pressed={color === c && tool === 'pen'}
            className={`w-6 h-6 rounded-full border-2 transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cta-500/40 ${color === c ? 'border-ink-900 scale-110' : 'border-white shadow-sm'}`}
            style={{ backgroundColor: c }}
          />
        ))}
        </div>
        <div className="flex-1" />
        <button type="button" onClick={clearCanvas} className="text-xs text-ink-500 hover:text-error-700 font-medium min-h-[36px] px-2 rounded focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cta-500/40">{t('panel.wb.clear')}</button>
      </div>
      <div className="flex-1 p-2 bg-ink-100">
        <canvas
          ref={canvasRef}
          width={288}
          height={400}
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={stopDraw}
          onMouseLeave={stopDraw}
          role="img"
          aria-label={t('panel.wb.canvas')}
          className="w-full h-full rounded-lg bg-white shadow-sm cursor-crosshair"
        />
      </div>
      <div className="px-4 py-2.5 border-t border-ink-100">
        <Button variant="secondary" size="sm" className="w-full">
          <FileText size={14} aria-hidden="true" /> {t('panel.wb.save')}
        </Button>
      </div>
    </>
  );
}

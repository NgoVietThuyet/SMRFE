import { useRef, useEffect, useState } from 'react';
import { PenTool, Circle, FileText } from 'lucide-react';
import { PanelHeader } from '@/components/meeting/PanelHeader';

interface WhiteboardPanelProps {
  onClose: () => void;
}

export function WhiteboardPanel({ onClose }: WhiteboardPanelProps) {
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
      <PanelHeader title="Whiteboard" icon={PenTool} onClose={onClose} />
      <div className="px-4 py-2.5 border-b border-ink-100 flex items-center gap-2">
        <button onClick={() => setTool('pen')} className={`p-1.5 rounded ${tool === 'pen' ? 'bg-primary-100 text-primary-700' : 'text-ink-400 hover:bg-ink-100'}`}>
          <PenTool size={16} />
        </button>
        <button onClick={() => setTool('eraser')} className={`p-1.5 rounded ${tool === 'eraser' ? 'bg-primary-100 text-primary-700' : 'text-ink-400 hover:bg-ink-100'}`}>
          <Circle size={16} />
        </button>
        <div className="w-px h-5 bg-ink-200" />
        {colors.map((c) => (
          <button
            key={c}
            onClick={() => { setColor(c); setTool('pen'); }}
            className={`w-5 h-5 rounded-full border-2 transition-all ${color === c ? 'border-ink-900 scale-110' : 'border-white'}`}
            style={{ backgroundColor: c }}
          />
        ))}
        <div className="flex-1" />
        <button onClick={clearCanvas} className="text-xs text-ink-400 hover:text-error-600 font-medium">Clear</button>
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
          className="w-full h-full rounded-lg bg-white shadow-sm cursor-crosshair"
        />
      </div>
      <div className="px-4 py-2.5 border-t border-ink-100">
        <button className="btn-secondary w-full text-xs py-2">
          <FileText size={14} /> Save Snapshot
        </button>
      </div>
    </>
  );
}

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export function Modal({ open, onClose, title, subtitle, children, footer }: ModalProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-drawer-overlay">
      <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[75%] max-w-[1200px] bg-white shadow-float animate-drawer-slide flex flex-col h-full">
        <div className="flex items-start justify-between px-6 py-4 border-b border-ink-100 shrink-0">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-ink-900 truncate">{title}</h2>
            {subtitle && <p className="text-sm text-ink-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-4 overflow-y-auto flex-1">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-ink-100 bg-ink-50/50 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

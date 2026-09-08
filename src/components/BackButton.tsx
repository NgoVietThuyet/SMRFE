import { ArrowLeft } from 'lucide-react';

interface BackButtonProps {
  onClick: () => void;
  label?: string;
  variant?: 'light' | 'dark';
}

export function BackButton({ onClick, label = 'Back', variant = 'light' }: BackButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all active:scale-[0.98] ${
        variant === 'light'
          ? 'text-ink-600 hover:bg-ink-100 hover:text-ink-900'
          : 'text-white/70 hover:bg-white/10 hover:text-white'
      }`}
    >
      <ArrowLeft size={16} />
      {label}
    </button>
  );
}

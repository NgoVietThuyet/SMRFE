import { ChevronLeft } from 'lucide-react';

interface BackButtonProps {
  onClick: () => void;
  label?: string;
  variant?: 'light' | 'dark';
}

export function BackButton({ onClick, label = 'Back', variant = 'light' }: BackButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`back-btn ${variant === 'light' ? 'back-btn-light' : 'back-btn-dark'}`}
    >
      <ChevronLeft size={18} aria-hidden="true" />
    </button>
  );
}

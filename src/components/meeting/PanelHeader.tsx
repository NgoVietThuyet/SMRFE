import { X, Users } from 'lucide-react';
import { useLanguage } from '@/i18n';

interface PanelHeaderProps {
  title: string;
  icon: typeof Users;
  onClose: () => void;
  action?: React.ReactNode;
}

export function PanelHeader({ title, icon: Icon, onClose, action }: PanelHeaderProps) {
  const { t } = useLanguage();
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100">
      <div className="flex items-center gap-2 min-w-0">
        <Icon size={18} aria-hidden="true" className="text-ink-600 shrink-0" />
        <h3 className="font-heading font-semibold text-ink-900 text-sm truncate">{title}</h3>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {action}
        <button
          type="button"
          onClick={onClose}
          aria-label={t('panel.close', { title })}
          className="min-w-[36px] min-h-[36px] inline-flex items-center justify-center p-1.5 rounded-lg text-ink-500 hover:bg-ink-100 hover:text-ink-700 transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cta-500/40"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

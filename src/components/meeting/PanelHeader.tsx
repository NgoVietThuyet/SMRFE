import { X, Users } from 'lucide-react';

interface PanelHeaderProps {
  title: string;
  icon: typeof Users;
  onClose: () => void;
  action?: React.ReactNode;
}

export function PanelHeader({ title, icon: Icon, onClose, action }: PanelHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-ink-100">
      <div className="flex items-center gap-2">
        <Icon size={18} className="text-ink-600" />
        <h3 className="font-semibold text-ink-900 text-sm">{title}</h3>
      </div>
      <div className="flex items-center gap-1">
        {action}
        <button onClick={onClose} className="p-1.5 rounded-lg text-ink-400 hover:bg-ink-100 hover:text-ink-700 transition-colors">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

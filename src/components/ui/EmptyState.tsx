import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={['card card-pad-lg text-center', className].join(' ')}>
      <div
        aria-hidden="true"
        className="w-14 h-14 mx-auto bg-ink-100 rounded-full flex items-center justify-center text-ink-500"
      >
        {icon ?? <Inbox size={28} />}
      </div>
      <p className="mt-4 text-ink-900 font-semibold font-heading">{title}</p>
      {description && (
        <div className="text-sm text-ink-500 mt-1 max-w-md mx-auto">{description}</div>
      )}
      {action && <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">{action}</div>}
    </div>
  );
}

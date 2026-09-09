import type { HTMLAttributes, ReactNode } from 'react';

export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  padding?: CardPadding;
  title?: ReactNode;
  description?: ReactNode;
  headerAction?: ReactNode;
}

const paddingMap: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'card-pad-sm',
  md: 'card-pad-md',
  lg: 'card-pad-lg',
};

export function Card({
  padding = 'md',
  title,
  description,
  headerAction,
  className = '',
  children,
  ...rest
}: CardProps) {
  const hasHeader = title !== undefined || headerAction !== undefined;

  return (
    <section className={['card', paddingMap[padding], className].join(' ')} {...rest}>
      {hasHeader && (
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            {typeof title === 'string' ? (
              <h3 className="font-heading font-semibold text-ink-900">{title}</h3>
            ) : (
              title
            )}
            {description && (
              typeof description === 'string' ? (
                <p className="text-sm text-ink-500 mt-0.5">{description}</p>
              ) : (
                description
              )
            )}
          </div>
          {headerAction && <div className="shrink-0">{headerAction}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

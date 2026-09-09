import type { ReactNode } from 'react';
import { Badge, type BadgeTone } from './Badge';
import { Button } from './Button';

export type StockStatus = 'in-stock' | 'low-stock' | 'out-of-stock' | 'pre-order';

export interface ProductCardProps {
  brand?: string;
  sku?: string;
  title: string;
  titleHref?: string;
  imageSrc?: string;
  imageAlt?: string;
  specs?: string[];
  stockStatus?: StockStatus;
  stockLabel?: string;
  priceFrom?: string;
  bulkHint?: string;
  onViewDetails?: () => void;
  onAddToQuote?: () => void;
  viewLabel?: string;
  quoteLabel?: string;
  footer?: ReactNode;
  className?: string;
}

const stockToneMap: Record<StockStatus, BadgeTone> = {
  'in-stock': 'success',
  'low-stock': 'warning',
  'out-of-stock': 'error',
  'pre-order': 'info',
};

const defaultStockLabel: Record<StockStatus, string> = {
  'in-stock': 'In stock',
  'low-stock': 'Low stock',
  'out-of-stock': 'Out of stock',
  'pre-order': 'Pre-order',
};

export function ProductCard({
  brand,
  sku,
  title,
  titleHref,
  imageSrc,
  imageAlt,
  specs = [],
  stockStatus,
  stockLabel,
  priceFrom,
  bulkHint,
  onViewDetails,
  onAddToQuote,
  viewLabel = 'View details',
  quoteLabel = 'Add to quote',
  footer,
  className = '',
}: ProductCardProps) {
  const titleNode = titleHref ? (
    <a
      href={titleHref}
      title={title}
      className="font-heading font-semibold text-ink-900 line-clamp-2 hover:text-cta-700 transition-colors"
    >
      {title}
    </a>
  ) : (
    <span title={title} className="font-heading font-semibold text-ink-900 line-clamp-2">
      {title}
    </span>
  );

  return (
    <article className={['card overflow-hidden flex flex-col', className].join(' ')}>
      <div className="relative aspect-[4/3] bg-ink-100 overflow-hidden">
        {imageSrc ? (
          <img
            src={imageSrc}
            alt={imageAlt ?? title}
            loading="lazy"
            width={640}
            height={480}
            className="w-full h-full object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="w-full h-full bg-grid flex items-center justify-center text-ink-400 text-sm"
          >
            No image
          </div>
        )}
        {stockStatus && (
          <div className="absolute top-2 left-2">
            <Badge tone={stockToneMap[stockStatus]}>
              <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current" />
              {stockLabel ?? defaultStockLabel[stockStatus]}
            </Badge>
          </div>
        )}
      </div>

      <div className="card-pad-md flex flex-col gap-2.5 flex-1">
        {(brand || sku) && (
          <p className="text-xs text-ink-500 truncate">
            {brand}
            {brand && sku && <span aria-hidden="true"> · </span>}
            {sku && <span className="tnum">{sku}</span>}
          </p>
        )}

        {titleNode}

        {specs.length > 0 && (
          <ul className="text-xs text-ink-500 space-y-1">
            {specs.slice(0, 3).map((spec) => (
              <li key={spec} className="flex items-start gap-1.5">
                <span aria-hidden="true" className="mt-1.5 w-1 h-1 rounded-full bg-ink-300 shrink-0" />
                <span className="line-clamp-1">{spec}</span>
              </li>
            ))}
          </ul>
        )}

        {(priceFrom || bulkHint) && (
          <div className="mt-auto pt-2 border-t border-ink-100">
            {priceFrom && (
              <p className="text-base font-bold text-ink-900 tnum">
                from {priceFrom}
              </p>
            )}
            {bulkHint && <p className="text-xs text-ink-500 tnum">{bulkHint}</p>}
          </div>
        )}

        <div className="flex items-center gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onViewDetails} className="flex-1">
            {viewLabel}
          </Button>
          <Button variant="cta" size="sm" onClick={onAddToQuote} className="flex-1">
            {quoteLabel}
          </Button>
        </div>

        {footer}
      </div>
    </article>
  );
}

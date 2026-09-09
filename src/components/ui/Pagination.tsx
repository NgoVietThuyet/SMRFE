import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
  className?: string;
}

function pageItems(page: number, totalPages: number): (number | 'ellipsis')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const siblings = new Set<number>([1, 2, page - 1, page, page + 1, totalPages - 1, totalPages]);
  const pages = [...siblings].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const items: (number | 'ellipsis')[] = [];
  let prev = 0;
  for (const p of pages) {
    if (p - prev > 1) items.push('ellipsis');
    items.push(p);
    prev = p;
  }
  return items;
}

export function Pagination({ page, totalPages, onChange, className = '' }: PaginationProps) {
  if (totalPages < 1) return null;

  return (
    <nav aria-label="Pagination" className={['flex items-center gap-1.5 flex-wrap', className].join(' ')}>
      <Button
        variant="secondary"
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Go to previous page"
        className="min-w-[32px] min-h-[32px]"
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </Button>

      {pageItems(page, totalPages).map((item, i) =>
        item === 'ellipsis' ? (
          <span key={`e-${i}`} aria-hidden="true" className="px-1 text-sm text-ink-400">
            …
          </span>
        ) : (
          <Button
            key={item}
            variant={item === page ? 'cta' : 'ghost'}
            size="sm"
            onClick={() => onChange(item)}
            aria-label={`Go to page ${item}`}
            aria-current={item === page ? 'page' : undefined}
            className={['min-w-[32px] min-h-[32px] tnum', item === page ? 'font-semibold' : ''].join(' ')}
          >
            {item}
          </Button>
        ),
      )}

      <Button
        variant="secondary"
        size="sm"
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
        aria-label="Go to next page"
        className="min-w-[32px] min-h-[32px]"
      >
        <ChevronRight size={16} aria-hidden="true" />
      </Button>
    </nav>
  );
}

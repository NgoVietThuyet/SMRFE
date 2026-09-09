import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { useLanguage } from '@/i18n';

export interface FilterChip {
  id: string;
  label: string;
}

export interface FilterPanelProps {
  chips: FilterChip[];
  onSelect: (id: string) => void;
  selectedId: string;
  className?: string;
  ariaLabel?: string;
}

export function FilterPanel({
  chips,
  onSelect,
  selectedId,
  className = '',
  ariaLabel = 'Filters',
}: FilterPanelProps) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={['flex items-center gap-1 flex-wrap bg-white border border-ink-200 rounded-lg p-1 w-fit max-w-full', className].join(' ')}
    >
      {chips.map((chip) => {
        const active = chip.id === selectedId;
        return (
          <button
            key={chip.id}
            type="button"
            onClick={() => onSelect(chip.id)}
            aria-pressed={active}
            className={[
              'px-3 min-h-[32px] text-xs font-medium rounded-md transition-colors capitalize whitespace-nowrap',
              active ? 'bg-cta-700 text-white' : 'text-ink-500 hover:bg-ink-100 hover:text-ink-900',
            ].join(' ')}
          >
            {chip.label}
          </button>
        );
      })}
    </div>
  );
}

export interface ActiveFilterChipsProps {
  active: FilterChip[];
  onRemove: (id: string) => void;
  onClearAll?: () => void;
  className?: string;
}

export function ActiveFilterChips({ active, onRemove, onClearAll, className = '' }: ActiveFilterChipsProps) {
  const { t } = useLanguage();
  if (active.length === 0) return null;

  return (
    <div className={['flex items-center gap-2 flex-wrap', className].join(' ')}>
      {active.map((chip) => (
        <span
          key={chip.id}
          className="badge bg-cta-50 text-cta-800 border border-cta-100"
        >
          {chip.label}
          <button
            type="button"
            onClick={() => onRemove(chip.id)}
            aria-label={t('common.removeFilter', { label: chip.label })}
            className="p-0.5 rounded-full hover:bg-cta-100 transition-colors min-w-[20px] min-h-[20px] flex items-center justify-center"
          >
            <X size={12} aria-hidden="true" />
          </button>
        </span>
      ))}
      {onClearAll && (
        <button
          type="button"
          onClick={onClearAll}
          className="text-xs font-medium text-ink-500 hover:text-error-600 underline-offset-2 hover:underline transition-colors min-h-[24px]"
        >
          {t('common.clearAll')}
        </button>
      )}
    </div>
  );
}

export function FilterSection({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <fieldset className="space-y-2">
      <legend className="text-xs font-semibold text-ink-500 uppercase tracking-wider">
        {title}
      </legend>
      {children}
    </fieldset>
  );
}

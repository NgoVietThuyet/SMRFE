import { forwardRef, useId } from 'react';
import { Search, X } from 'lucide-react';
import { useLanguage } from '@/i18n';

export interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSearch?: () => void;
  label?: string;
  placeholder?: string;
  showClear?: boolean;
  id?: string;
  className?: string;
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar(
  {
    value,
    onChange,
    onSearch,
    label,
    placeholder,
    showClear = true,
    id,
    className = '',
  },
  ref,
) {
  const { t } = useLanguage();
  const resolvedLabel = label ?? t('topbar.search.label');
  const resolvedPlaceholder = placeholder ?? t('topbar.search.placeholder');
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div role="search" className={['relative', className].join(' ')}>
      <label htmlFor={inputId} className="sr-only">
        {resolvedLabel}
      </label>
      <Search
        size={16}
        aria-hidden="true"
        className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-500 pointer-events-none"
      />
      <input
        ref={ref}
        id={inputId}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSearch?.();
        }}
        placeholder={resolvedPlaceholder}
        autoComplete="off"
        className="input-field pl-9 pr-9"
      />
      {showClear && value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label={t('common.clearSearch')}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-ink-500 hover:bg-ink-100 hover:text-ink-900 transition-colors min-w-[28px] min-h-[28px] flex items-center justify-center"
        >
          <X size={14} aria-hidden="true" />
        </button>
      )}
    </div>
  );
});

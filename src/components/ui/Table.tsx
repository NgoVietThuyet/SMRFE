import type { HTMLAttributes, ReactNode, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';

export function TableWrapper({ className = '', children, ...rest }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="overflow-x-auto rounded-[5px] border border-ink-200/70 bg-white shadow-card">
      <table className={['w-full text-sm', className].join(' ')} {...rest}>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ className = '', children, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={['bg-ink-100', className].join(' ')} {...rest}>
      {children}
    </thead>
  );
}

interface SortableThProps extends ThHTMLAttributes<HTMLTableCellElement> {
  sortDirection?: 'asc' | 'desc' | false;
  onSort?: () => void;
  label: string;
}

export function SortableTh({ sortDirection = false, onSort, label, className = '', ...rest }: SortableThProps) {
  const icon =
    sortDirection === 'asc' ? <ArrowUp size={14} aria-hidden="true" /> :
    sortDirection === 'desc' ? <ArrowDown size={14} aria-hidden="true" /> :
    <ChevronsUpDown size={14} aria-hidden="true" className="text-ink-400" />;

  const inner = (
    <>
      {label}
      <span className="inline-flex shrink-0">{icon}</span>
    </>
  );

  return (
    <th
      scope="col"
      aria-sort={sortDirection === 'asc' ? 'ascending' : sortDirection === 'desc' ? 'descending' : undefined}
      className={['py-2.5 px-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider', className].join(' ')}
      {...rest}
    >
      {onSort ? (
        <button
          type="button"
          onClick={onSort}
          aria-label={`Sort by ${label}${sortDirection === 'asc' ? ' (sorted ascending)' : sortDirection === 'desc' ? ' (sorted descending)' : ''}`}
          className="inline-flex items-center gap-1.5 hover:text-ink-900 transition-colors min-h-[24px]"
        >
          {inner}
        </button>
      ) : (
        <span className="inline-flex items-center gap-1.5">{label}</span>
      )}
    </th>
  );
}

export function Th({ className = '', children, ...rest }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      scope="col"
      className={['py-2.5 px-3 text-left text-xs font-semibold text-ink-500 uppercase tracking-wider', className].join(' ')}
      {...rest}
    >
      {children}
    </th>
  );
}

export function Td({ className = '', children, ...rest }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td className={['py-3 px-3 text-sm text-ink-700 align-middle', className].join(' ')} {...rest}>
      {children}
    </td>
  );
}

export function TableRow({
  className = '',
  children,
  ...rest
}: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={['border-b border-ink-100 last:border-0 hover:bg-ink-50/50 transition-colors', className].join(' ')} {...rest}>
      {children}
    </tr>
  );
}

export interface TableEmptyProps {
  message?: ReactNode;
}

export function TableEmpty({ message = 'No results found' }: TableEmptyProps) {
  return (
    <TableRow>
      <Td colSpan={99} className="text-center py-10 text-ink-500">
        {message}
      </Td>
    </TableRow>
  );
}

export type { ReactNode };

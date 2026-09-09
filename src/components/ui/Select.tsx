import { forwardRef, useId, type SelectHTMLAttributes } from 'react';

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  helperText?: string;
  error?: string;
  hideLabel?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, helperText, error, hideLabel = false, id, className = '', children, ...rest },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const errorId = error ? `${selectId}-error` : undefined;
  const helperId = helperText ? `${selectId}-helper` : undefined;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={selectId}
          className={hideLabel ? 'sr-only' : 'field-label'}
        >
          {label}
          {rest.required && <span aria-hidden="true" className="text-error-600"> *</span>}
        </label>
      )}
      
      <select
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={[errorId, helperId].filter(Boolean).join(' ') || undefined}
        className={[
          'input-field pr-10 appearance-none cursor-pointer',
          'bg-[url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27%2364748b%27 stroke-width=%272%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27m6 9 6 6 6-6%27/%3E%3C/svg%3E")] bg-no-repeat bg-[center_right_0.75rem]',
          error ? 'border-error-500 focus:border-error-600 focus:ring-error-500/20' : '',
          className,
        ].join(' ')}
        {...rest}
      >
        {children}
      </select>
      {error && (
        <p id={errorId} role="alert" className="field-error">
          {error}
        </p>
      )}
      {!error && helperText && (
        <p id={helperId} className="field-helper">
          {helperText}
        </p>
      )}
    </div>
  );
});

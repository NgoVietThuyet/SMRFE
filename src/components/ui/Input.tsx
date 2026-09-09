import { forwardRef, useId, type InputHTMLAttributes } from 'react';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  hideLabel?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, helperText, error, hideLabel = false, id, className = '', ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const errorId = error ? `${inputId}-error` : undefined;
  const helperId = helperText ? `${inputId}-helper` : undefined;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={inputId}
          className={hideLabel ? 'sr-only' : 'field-label'}
        >
          {label}
          {rest.required && <span aria-hidden="true" className="text-error-600"> *</span>}
        </label>
      )}
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={[errorId, helperId].filter(Boolean).join(' ') || undefined}
        className={[
          'input-field',
          error ? 'border-error-500 focus:border-error-600 focus:ring-error-500/20' : '',
          className,
        ].join(' ')}
        {...rest}
      />
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

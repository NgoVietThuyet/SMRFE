import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  helperText?: string;
  error?: string;
  hideLabel?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, helperText, error, hideLabel = false, id, className = '', ...rest },
  ref,
) {
  const autoId = useId();
  const areaId = id ?? autoId;
  const errorId = error ? `${areaId}-error` : undefined;
  const helperId = helperText ? `${areaId}-helper` : undefined;

  return (
    <div className="w-full">
      {label && (
        <label
          htmlFor={areaId}
          className={hideLabel ? 'sr-only' : 'field-label'}
        >
          {label}
          {rest.required && <span aria-hidden="true" className="text-error-600"> *</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={areaId}
        aria-invalid={error ? true : undefined}
        aria-describedby={[errorId, helperId].filter(Boolean).join(' ') || undefined}
        className={[
          'input-field min-h-[88px] resize-y',
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

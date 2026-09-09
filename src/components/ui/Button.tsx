import { forwardRef, type ButtonHTMLAttributes } from 'react';

export type ButtonVariant = 'primary' | 'cta' | 'brand' | 'secondary' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const variantMap: Record<ButtonVariant, string> = {
  // Primary = enterprise navy #1E3A8A (chuẩn hóa theo spec), hover #1E40AF.
  primary: 'bg-primary-900 text-white shadow-sm hover:bg-primary-800 hover:shadow-md',
  // cta/brand giữ nguyên để không vỡ các màn hình cũ đang dùng.
  cta: 'bg-cta-700 text-white shadow-sm hover:bg-cta-800 hover:shadow-md',
  brand: 'bg-brand-900 text-white shadow-sm hover:bg-brand-800 hover:shadow-md',
  secondary:
    'bg-white text-ink-700 border border-ink-200 hover:bg-ink-50 hover:border-ink-300',
  ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
  danger: 'bg-error-600 text-white shadow-sm hover:bg-error-700 hover:shadow-md',
  success: 'bg-success-600 text-white shadow-sm hover:bg-success-700 hover:shadow-md',
};

const sizeMap: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-[5px]',
  md: 'h-10 px-4 py-2 text-sm gap-2 rounded-[5px]',
  lg: 'h-12 px-6 text-base gap-2 rounded-[5px]',
};

function Spinner() {
  return (
    <span
      aria-hidden="true"
      className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin opacity-70"
    />
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', loading = false, disabled, className = '', children, type = 'button', ...rest },
  ref,
) {
  const isDisabled = disabled || loading;
  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading || undefined}
      className={[
        'inline-flex items-center justify-center font-medium transition-all duration-200',
        'focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-cta-500/40 focus-visible:ring-offset-1',
        'active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:cursor-not-allowed',
        'cursor-pointer',
        variantMap[variant],
        sizeMap[size],
        className,
      ].join(' ')}
      {...rest}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
});

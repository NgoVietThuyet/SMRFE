import type { HTMLAttributes } from 'react';

export interface LoadingSpinnerProps extends HTMLAttributes<HTMLDivElement> {
  label?: string;
}

export function LoadingSpinner({ label = 'Loading...', className = '', ...rest }: LoadingSpinnerProps) {
  return (
    <div role="status" aria-live="polite" className={['flex items-center justify-center gap-2 py-8', className].join(' ')} {...rest}>
      <span
        aria-hidden="true"
        className="w-6 h-6 border-2 border-ink-200 border-t-cta-600 rounded-full animate-spin"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  lines?: number;
}

export function Skeleton({ lines = 3, className = '', ...rest }: SkeletonProps) {
  return (
    <div role="status" aria-label="Loading content" className={['space-y-2.5 animate-pulse', className].join(' ')} {...rest}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          aria-hidden="true"
          className="h-4 rounded-md bg-ink-100"
          style={{ width: `${100 - i * 12}%` }}
        />
      ))}
      <span className="sr-only">Loading content…</span>
    </div>
  );
}

export interface CardSkeletonProps {
  count?: number;
  className?: string;
}

export function CardSkeleton({ count = 3, className = '' }: CardSkeletonProps) {
  return (
    <div role="status" aria-label="Loading cards" className={['grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 animate-pulse', className].join(' ')}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} aria-hidden="true" className="card card-pad-md space-y-3">
          <div className="h-5 rounded-md bg-ink-100 w-3/4" />
          <div className="h-4 rounded-md bg-ink-100 w-full" />
          <div className="h-4 rounded-md bg-ink-100 w-5/6" />
          <div className="h-9 rounded-lg bg-ink-100 w-full" />
        </div>
      ))}
      <span className="sr-only">Loading cards…</span>
    </div>
  );
}

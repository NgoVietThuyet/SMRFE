/** Fallback khi chưa có DOM (SSR/test) — khớp @primary-color trong theme.less */
const SYSTEM_PRIMARY_FALLBACK = '#189AD6';
const SYSTEM_PRIMARY_LIGHT_FALLBACK = '#40b8e0';

export function readCssSystemPrimary(): string {
  if (typeof document === 'undefined') {
    return SYSTEM_PRIMARY_FALLBACK;
  }
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--system-primary').trim() ||
    SYSTEM_PRIMARY_FALLBACK
  );
}

export function readCssSystemPrimaryLight(): string {
  if (typeof document === 'undefined') {
    return SYSTEM_PRIMARY_LIGHT_FALLBACK;
  }
  return (
    getComputedStyle(document.documentElement).getPropertyValue('--system-primary-light').trim() ||
    SYSTEM_PRIMARY_LIGHT_FALLBACK
  );
}

/** Fallback khi chưa có DOM (SSR/test) — khớp @primary-color trong theme.less */
const SYSTEM_PRIMARY_FALLBACK = '#0E76A8';
const SYSTEM_PRIMARY_LIGHT_FALLBACK = '#2A92C4';

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

/** Escape plain text for safe use in SweetAlert `text` / UI strings. */
export function escapeHtmlText(value: string | null | undefined): string {
  if (!value) return '';
  if (typeof document === 'undefined') {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
  const el = document.createElement('div');
  el.textContent = value;
  return el.innerHTML;
}

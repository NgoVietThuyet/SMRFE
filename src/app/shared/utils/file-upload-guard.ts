/** Client-side hints — must mirror backend FileUploadValidator limits. */
export const UPLOAD_MAX_BYTES = {
  explorer: 200 * 1024 * 1024,
  chat: 100 * 1024 * 1024,
  chatBot: 50 * 1024 * 1024,
  avatar: 2 * 1024 * 1024,
} as const;

const BLOCKED_EXTENSIONS = new Set([
  '.aspx', '.php', '.jsp', '.html', '.htm', '.svg', '.js', '.exe', '.dll', '.bat', '.cmd', '.ps1',
]);

export function getFileExtension(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? name;
  const idx = base.lastIndexOf('.');
  return idx >= 0 ? base.slice(idx).toLowerCase() : '';
}

export function hasBlockedExtension(name: string): boolean {
  const parts = name.split('.');
  for (let i = 1; i < parts.length; i++) {
    const ext = '.' + parts[i].toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) return true;
  }
  return BLOCKED_EXTENSIONS.has(getFileExtension(name));
}

export function validateClientFile(file: File, maxBytes: number, allowed?: string[]): string | null {
  if (!file || file.size <= 0) return 'File không hợp lệ';
  if (file.size > maxBytes) return `File vượt quá ${Math.round(maxBytes / (1024 * 1024))}MB`;
  if (hasBlockedExtension(file.name)) return 'Loại file không được phép';
  if (allowed?.length) {
    const ext = getFileExtension(file.name);
    if (!allowed.includes(ext)) return `Định dạng ${ext || '(không xác định)'} không được phép`;
  }
  return null;
}

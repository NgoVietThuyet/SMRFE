export type FilePreviewMode = 'pdf' | 'onlyoffice' | 'image' | 'video' | 'unsupported';

const PDF_EXT = ['.pdf'];
const OFFICE_EXT = ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv', '.rtf'];
const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg'];
const VIDEO_EXT = ['.mp4', '.avi', '.mov', '.mkv', '.webm'];

export function getFileExtensionDot(fileName: string): string {
  if (!fileName) return '';
  const dot = fileName.lastIndexOf('.');
  return dot >= 0 ? fileName.substring(dot).toLowerCase() : '';
}

export function resolveFilePreviewMode(fileName: string): FilePreviewMode {
  const ext = getFileExtensionDot(fileName);
  if (!ext) return 'unsupported';
  if (PDF_EXT.includes(ext)) return 'pdf';
  if (OFFICE_EXT.includes(ext)) return 'onlyoffice';
  if (IMAGE_EXT.includes(ext)) return 'image';
  if (VIDEO_EXT.includes(ext)) return 'video';
  return 'unsupported';
}

export function fileNameHasExtension(fileName: string): boolean {
  return getFileExtensionDot(fileName).length > 0;
}

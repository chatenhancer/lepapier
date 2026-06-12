import { sanitizeFileName } from '../shared/text';

export interface MediaDropZoneOptions {
  multiple: boolean;
  onFiles(files: File[]): void;
}

export function setupMediaDropZone(dropZone: Element | null, options: MediaDropZoneOptions): void {
  if (!dropZone) return;

  let dragDepth = 0;

  dropZone.addEventListener('dragenter', (event) => {
    const dragEvent = event as DragEvent;
    if (!hasMediaDrag(dragEvent)) return;
    dragEvent.preventDefault();
    dragDepth += 1;
    dropZone.classList.add('is-dragging');
  });

  dropZone.addEventListener('dragover', (event) => {
    const dragEvent = event as DragEvent;
    if (!hasMediaDrag(dragEvent)) return;
    dragEvent.preventDefault();
    if (dragEvent.dataTransfer) {
      dragEvent.dataTransfer.dropEffect = 'copy';
    }
  });

  dropZone.addEventListener('dragleave', () => {
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      dropZone.classList.remove('is-dragging');
    }
  });

  dropZone.addEventListener('drop', (event) => {
    const dragEvent = event as DragEvent;
    const files = getDroppedMediaFiles(dragEvent.dataTransfer, options.multiple);
    dragEvent.preventDefault();
    dragDepth = 0;
    dropZone.classList.remove('is-dragging');
    if (!files.length) return;
    options.onFiles(files);
  });
}

export function getDroppedMediaFiles(dataTransfer: DataTransfer | null, multiple: boolean): File[] {
  const files = getMediaFiles(dataTransfer);
  return multiple ? files : files.slice(0, 1);
}

export function getClipboardMediaFiles(dataTransfer: DataTransfer | null): File[] {
  return getMediaFiles(dataTransfer);
}

export function getMediaAltText(fileName: string, fileType = ''): string {
  const fallback = fileType.startsWith('video/') ? 'Video' : 'Image';
  return fileName
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim() || fallback;
}

export function formatMediaMeta(bytes: number, width?: number, height?: number): string {
  const size = formatFileSize(bytes);
  if (width && height) return `${width} x ${height} px - ${size}`;
  return size;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return 'Unknown size';

  const units = ['B', 'KB', 'MB', 'GB'];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = unitIndex === 0 || value >= 10 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

function hasMediaDrag(event: DragEvent): boolean {
  const types = Array.from(event.dataTransfer?.types || []);
  return types.includes('Files');
}

function getMediaFiles(dataTransfer: DataTransfer | null): File[] {
  return Array.from(dataTransfer?.files || [])
    .filter(isSupportedMediaFile);
}

export function isSupportedMediaFile(file: File): boolean {
  return file.type.startsWith('image/') || file.type.startsWith('video/');
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/');
}

export function sanitizeMediaFileName(file: File): string {
  if (!file.name.trim() && isVideoFile(file)) {
    return `video${getDefaultVideoExtension(file.type)}`;
  }

  const name = sanitizeFileName(file.name);
  if (hasFileExtension(file.name) || !isVideoFile(file)) return name;

  return name.replace(/\.[a-z0-9]+$/i, getDefaultVideoExtension(file.type));
}

function hasFileExtension(fileName: string): boolean {
  return /\.[a-z0-9]+$/i.test(fileName);
}

function getDefaultVideoExtension(fileType: string): string {
  if (fileType === 'video/webm') return '.webm';
  if (fileType === 'video/ogg') return '.ogv';
  if (fileType === 'video/quicktime') return '.mov';
  if (fileType === 'video/x-m4v') return '.m4v';
  return '.mp4';
}

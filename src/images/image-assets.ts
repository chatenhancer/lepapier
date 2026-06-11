export interface ImageDropZoneOptions {
  multiple: boolean;
  onFiles(files: File[]): void;
}

export function setupImageDropZone(dropZone: Element | null, options: ImageDropZoneOptions): void {
  if (!dropZone) return;

  let dragDepth = 0;

  dropZone.addEventListener('dragenter', (event) => {
    const dragEvent = event as DragEvent;
    if (!hasImageDrag(dragEvent)) return;
    dragEvent.preventDefault();
    dragDepth += 1;
    dropZone.classList.add('is-dragging');
  });

  dropZone.addEventListener('dragover', (event) => {
    const dragEvent = event as DragEvent;
    if (!hasImageDrag(dragEvent)) return;
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
    const files = getDroppedImages(dragEvent.dataTransfer, options.multiple);
    dragEvent.preventDefault();
    dragDepth = 0;
    dropZone.classList.remove('is-dragging');
    if (!files.length) return;
    options.onFiles(files);
  });
}

export function getDroppedImages(dataTransfer: DataTransfer | null, multiple: boolean): File[] {
  const files = getImageFiles(dataTransfer);
  return multiple ? files : files.slice(0, 1);
}

export function getClipboardImages(dataTransfer: DataTransfer | null): File[] {
  return getImageFiles(dataTransfer);
}

export function getImageAltText(fileName: string): string {
  return fileName
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim() || 'Image';
}

export function formatImageMeta(bytes: number, width?: number, height?: number): string {
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

function hasImageDrag(event: DragEvent): boolean {
  const types = Array.from(event.dataTransfer?.types || []);
  return types.includes('Files');
}

function getImageFiles(dataTransfer: DataTransfer | null): File[] {
  return Array.from(dataTransfer?.files || [])
    .filter((file) => file.type.startsWith('image/'));
}

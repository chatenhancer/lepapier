import { trimNumber } from '../shared/text';

export const defaultImageCropRatio = 16 / 9;
export const maximumImageCropRatio = 3;
export const maximumImageRotation = 8;
export const minimumImageCropRatio = 0.6;

export interface ImageAttributes {
  align: 'left' | 'center' | 'right';
  cropRatio: number;
  display: 'block' | 'inline';
  focusX: number;
  focusY: number;
  rotation: number;
  shadow: boolean;
  width: number;
}

export function parseImageAttributes(value: string | undefined): ImageAttributes {
  const attributes: ImageAttributes = {
    align: 'left',
    cropRatio: 0,
    display: 'block',
    focusX: 50,
    focusY: 50,
    rotation: 0,
    shadow: false,
    width: 100
  };

  for (const part of String(value || '').split(/[;\s]+/)) {
    const separatorIndex = part.indexOf('=');
    if (separatorIndex < 1) continue;
    const rawName = part.slice(0, separatorIndex);
    const rawValue = part.slice(separatorIndex + 1);
    const name = rawName?.trim();
    const option = rawValue?.trim();
    if (name === 'width') {
      attributes.width = clampImageWidth(Number(String(option || '').replace(/%$/, '')));
    }
    if (name === 'align' && isImageAlignment(option)) {
      attributes.align = option;
    }
    if (name === 'display' && isImageDisplay(option)) {
      attributes.display = option;
    }
    if (name === 'crop') {
      attributes.cropRatio = parseImageCropRatio(option);
    }
    if (name === 'focus') {
      const focus = parseImageFocus(option);
      attributes.focusX = focus.x;
      attributes.focusY = focus.y;
    }
    if (['rotate', 'rotation', 'tilt'].includes(name)) {
      attributes.rotation = clampImageRotation(option?.replace(/deg$/, ''));
    }
    if (name === 'shadow') {
      attributes.shadow = ['smooth', 'true'].includes(option);
    }
  }

  return attributes;
}

export function formatImageAttributes(attributes: Partial<ImageAttributes>): string {
  const parts: string[] = [];
  const width = clampImageWidth(attributes.width);
  const align = isImageAlignment(attributes.align) ? attributes.align : 'left';
  const cropRatio = clampImageCropRatio(attributes.cropRatio);
  const focusX = clampImageFocus(attributes.focusX);
  const focusY = clampImageFocus(attributes.focusY);
  const rotation = clampImageRotation(attributes.rotation);
  if (width !== 100) {
    parts.push(`width=${width}%`);
  }
  if (align !== 'left') {
    parts.push(`align=${align}`);
  }
  if (attributes.display === 'inline') {
    parts.push('display=inline');
  }
  if (attributes.shadow) {
    parts.push('shadow=smooth');
  }
  if (cropRatio > 0 && attributes.display !== 'inline') {
    parts.push(`crop=${formatImageCropRatio(cropRatio)}`);
    if (focusX !== 50 || focusY !== 50) {
      parts.push(`focus=${formatImageFocus(focusX, focusY)}`);
    }
  }
  if (rotation !== 0) {
    parts.push(`rotate=${rotation}deg`);
  }
  return parts.length ? `{${parts.join(';')}}` : '';
}

export function clampImageWidth(value: unknown): number {
  return Math.min(100, Math.max(25, Number.isFinite(value) ? Number(value) : 100));
}

export function parseImageCropRatio(value: unknown): number {
  const source = String(value || '').trim();
  if (!source || source === 'false' || source === 'none') return 0;
  if (source === 'true') return defaultImageCropRatio;
  if (source.includes(':')) {
    const [width, height] = source.split(':').map((part) => Number.parseFloat(part));
    if (Number.isFinite(width) && Number.isFinite(height) && height > 0) {
      return clampImageCropRatio(width / height);
    }
  }
  return clampImageCropRatio(Number.parseFloat(source));
}

export function parseImageFocus(value: unknown): { x: number; y: number } {
  const parts = String(value || '').split(',').map((part) => Number.parseFloat(part));
  return {
    x: clampImageFocus(parts[0]),
    y: clampImageFocus(parts[1])
  };
}

export function formatImageCropRatio(value: unknown): string {
  const ratio = clampImageCropRatio(value);
  if (Math.abs(ratio - (16 / 9)) < 0.01) return '16:9';
  if (Math.abs(ratio - 1) < 0.01) return '1:1';
  if (Math.abs(ratio - (4 / 3)) < 0.01) return '4:3';
  return trimNumber(ratio, 2);
}

export function formatImageFocus(focusX: unknown, focusY: unknown): string {
  return `${trimNumber(clampImageFocus(focusX), 1)}%,${trimNumber(clampImageFocus(focusY), 1)}%`;
}

export function clampImageCropRatio(value: unknown): number {
  const ratio = Number.parseFloat(String(value));
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  return Math.min(maximumImageCropRatio, Math.max(minimumImageCropRatio, Math.round(ratio * 100) / 100));
}

export function clampImageFocus(value: unknown): number {
  const focus = Number.parseFloat(String(value));
  if (!Number.isFinite(focus)) return 50;
  return Math.min(100, Math.max(0, Math.round(focus * 10) / 10));
}

export function clampImageRotation(value: unknown): number {
  const rotation = Number.parseFloat(String(value));
  if (!Number.isFinite(rotation)) return 0;
  return Math.min(maximumImageRotation, Math.max(-maximumImageRotation, Math.round(rotation * 2) / 2));
}

function isImageAlignment(value: unknown): value is ImageAttributes['align'] {
  return value === 'left' || value === 'center' || value === 'right';
}

function isImageDisplay(value: unknown): value is ImageAttributes['display'] {
  return value === 'block' || value === 'inline';
}

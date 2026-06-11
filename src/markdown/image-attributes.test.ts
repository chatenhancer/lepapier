import { describe, expect, it } from 'vitest';

import {
  clampImageCropRatio,
  clampImageFocus,
  clampImageRotation,
  clampImageWidth,
  defaultImageCropRatio,
  formatImageAttributes,
  formatImageCropRatio,
  formatImageFocus,
  parseImageAttributes,
  parseImageCropRatio,
  parseImageFocus
} from './image-attributes';

describe('image attributes', () => {
  it('parses editor image attributes', () => {
    expect(parseImageAttributes('width=45%;align=center;crop=16:9;focus=20,80;rotate=3.2deg;shadow=smooth')).toEqual({
      align: 'center',
      cropRatio: 1.78,
      display: 'block',
      focusX: 20,
      focusY: 80,
      rotation: 3,
      shadow: true,
      width: 45
    });
  });

  it('formats only non-default image attributes', () => {
    expect(formatImageAttributes({
      align: 'center',
      cropRatio: 16 / 9,
      display: 'block',
      focusX: 20,
      focusY: 80,
      rotation: 3,
      shadow: true,
      width: 45
    })).toBe('{width=45%;align=center;shadow=smooth;crop=16:9;focus=20%,80%;rotate=3deg}');
  });

  it('clamps attribute controls to supported editor ranges', () => {
    expect(clampImageWidth(10)).toBe(25);
    expect(clampImageFocus(123)).toBe(100);
    expect(clampImageRotation(99)).toBe(8);
    expect(clampImageCropRatio(99)).toBe(3);
  });

  it('parses and formats crop and focus helpers', () => {
    expect(parseImageCropRatio('true')).toBe(defaultImageCropRatio);
    expect(parseImageCropRatio('none')).toBe(0);
    expect(parseImageFocus('12.34,98.76')).toEqual({ x: 12.3, y: 98.8 });
    expect(formatImageCropRatio(4 / 3)).toBe('4:3');
    expect(formatImageFocus(12.34, 98.76)).toBe('12.3%,98.8%');
  });
});

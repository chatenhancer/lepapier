import { describe, expect, it } from 'vitest';

import {
  formatFileSize,
  formatImageMeta,
  getImageAltText
} from './image-assets';

describe('image asset helpers', () => {
  it('creates readable alt text from file names', () => {
    expect(getImageAltText('hero-shot_v2.png')).toBe('hero shot v2');
    expect(getImageAltText('  .png')).toBe('Image');
  });

  it('formats image dimensions and file sizes', () => {
    expect(formatImageMeta(1536, 1200, 800)).toBe('1200 x 800 px - 1.5 KB');
    expect(formatImageMeta(1024)).toBe('1.0 KB');
    expect(formatFileSize(-1)).toBe('Unknown size');
  });
});

import { describe, expect, it } from 'vitest';

import {
  formatFileSize,
  formatMediaMeta,
  getMediaAltText,
  isSupportedMediaFile,
  isVideoFile,
  sanitizeMediaFileName
} from './media-assets';

describe('media asset helpers', () => {
  it('creates readable alt text from file names', () => {
    expect(getMediaAltText('hero-shot_v2.png')).toBe('hero shot v2');
    expect(getMediaAltText('  .png')).toBe('Image');
    expect(getMediaAltText('demo-clip.mp4', 'video/mp4')).toBe('demo clip');
    expect(getMediaAltText('  .mp4', 'video/mp4')).toBe('Video');
  });

  it('formats media dimensions and file sizes', () => {
    expect(formatMediaMeta(1536, 1200, 800)).toBe('1200 x 800 px - 1.5 KB');
    expect(formatMediaMeta(1024)).toBe('1.0 KB');
    expect(formatFileSize(-1)).toBe('Unknown size');
  });

  it('accepts image and video media files', () => {
    expect(isSupportedMediaFile(new File(['image'], 'hero.png', { type: 'image/png' }))).toBe(true);
    expect(isSupportedMediaFile(new File(['video'], 'clip.mp4', { type: 'video/mp4' }))).toBe(true);
    expect(isSupportedMediaFile(new File(['text'], 'notes.txt', { type: 'text/plain' }))).toBe(false);
    expect(isVideoFile(new File(['video'], 'clip.mp4', { type: 'video/mp4' }))).toBe(true);
  });

  it('keeps video extensions when clipboard filenames are generic', () => {
    expect(sanitizeMediaFileName(new File(['video'], 'recording', { type: 'video/webm' }))).toBe('recording.webm');
    expect(sanitizeMediaFileName(new File(['video'], '', { type: 'video/mp4' }))).toBe('video.mp4');
    expect(sanitizeMediaFileName(new File(['image'], 'hero', { type: 'image/png' }))).toBe('hero.png');
  });
});

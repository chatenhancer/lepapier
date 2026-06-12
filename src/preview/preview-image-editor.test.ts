import { describe, expect, it } from 'vitest';

import {
  removeMarkdownImage,
  setMarkdownImageAlignment,
  setMarkdownImageCrop,
  setMarkdownImageCropFocus,
  setMarkdownImageDisplay,
  setMarkdownImageRotation,
  setMarkdownImageShadow,
  setMarkdownImageWidth,
  wrapMarkdownImageWithSideText
} from './preview-image-transforms';

describe('preview image markdown transforms', () => {
  it('updates image attributes without touching other images', () => {
    const markdown = '![Hero](hero.png)\n\n![Other](other.png){width=40}';

    expect(setMarkdownImageWidth(markdown, 'hero.png', 75)).toContain('![Hero](hero.png){width=75%}');
    expect(setMarkdownImageAlignment(markdown, 'hero.png', 'center')).toContain('![Hero](hero.png){align=center}');
    expect(setMarkdownImageAlignment('![Hero](hero.png){align=center}', 'hero.png', 'left')).toBe('![Hero](hero.png)');
    expect(setMarkdownImageShadow(markdown, 'hero.png', true)).toContain('![Hero](hero.png){shadow=smooth}');
    expect(setMarkdownImageRotation(markdown, 'hero.png', 8)).toContain('![Hero](hero.png){rotate=8deg}');
    expect(setMarkdownImageWidth(markdown, 'missing.png', 75)).toBe(markdown);
  });

  it('normalizes crop and inline display attributes', () => {
    const markdown = '![Hero](hero.png){crop=1.2 focus=20,30 align=center}';

    expect(setMarkdownImageCrop(markdown, 'hero.png', 0)).toBe('![Hero](hero.png){align=center}');
    expect(setMarkdownImageCropFocus('![Hero](hero.png)', 'hero.png', 20, 80))
      .toBe('![Hero](hero.png){crop=16:9;focus=20%,80%}');
    expect(setMarkdownImageDisplay(markdown, 'hero.png', 'inline'))
      .toBe('![Hero](hero.png){display=inline}');
  });

  it('removes a selected standalone image from markdown', () => {
    const markdown = ['Intro', '', '![Hero](hero.png){align=center}', '', 'Outro'].join('\n');

    expect(removeMarkdownImage(markdown, 'hero.png', 0)).toBe(['Intro', '', 'Outro'].join('\n'));
  });

  it('unwraps media block copy when removing the block image', () => {
    const markdown = [
      'Intro',
      '',
      ':::media-right',
      '',
      '![Hero](hero.png){width=60%}',
      '',
      'Side copy',
      '',
      ':::',
      '',
      'Outro'
    ].join('\n');

    expect(removeMarkdownImage(markdown, 'hero.png', 0)).toBe([
      'Intro',
      '',
      'Side copy',
      '',
      'Outro'
    ].join('\n'));
  });

  it('wraps a standalone image in a media block', () => {
    const markdown = 'Intro\n\n![Hero](hero.png)\n\nOutro';

    expect(wrapMarkdownImageWithSideText(markdown, 'hero.png', 'right')).toBe([
      'Intro',
      '',
      ':::media-right',
      '',
      '![Hero](hero.png)',
      '',
      'Write side text here.',
      '',
      ':::',
      '',
      'Outro'
    ].join('\n'));
  });

  it('does not wrap images already inside media blocks', () => {
    const markdown = [
      ':::media-left',
      '',
      '![Hero](hero.png)',
      '',
      'Copy',
      '',
      ':::'
    ].join('\n');

    expect(wrapMarkdownImageWithSideText(markdown, 'hero.png', 'right')).toBe(markdown);
  });
});

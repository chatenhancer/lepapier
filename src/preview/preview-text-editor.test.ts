import { describe, expect, it } from 'vitest';

import {
  formatPreviewMarkdownBlock,
  updatePreviewMarkdownBlock,
  updateMarkdownMediaBlockText
} from './preview-text-editor';

describe('preview text editor helpers', () => {
  it('formats edited preview text back to markdown blocks', () => {
    expect(formatPreviewMarkdownBlock('H2', 'Section')).toBe('## Section');
    expect(formatPreviewMarkdownBlock('LI', 'One\nTwo')).toBe('- One\n- Two');
    expect(formatPreviewMarkdownBlock('BLOCKQUOTE', 'One\nTwo')).toBe('> One\n> Two');
    expect(formatPreviewMarkdownBlock('P', 'One\n\nTwo')).toBe('One\n\nTwo');
  });

  it('saves an emptied preview paragraph back to markdown', () => {
    const markdown = ['Intro', '', 'Delete me', '', 'Outro'].join('\n');
    const start = markdown.indexOf('Delete me');
    const end = start + 'Delete me'.length;

    expect(updatePreviewMarkdownBlock(markdown, start, end, 'P', '')).toBe(['Intro', '', '', '', 'Outro'].join('\n'));
  });

  it('saves an emptied preview heading back to markdown', () => {
    const markdown = ['# Old', '', 'Next'].join('\n');

    expect(updatePreviewMarkdownBlock(markdown, 0, '# Old'.length, 'H1', '')).toBe(['', '', 'Next'].join('\n'));
  });

  it('updates media block copy while preserving direction and image line', () => {
    const markdown = [
      'Intro',
      '',
      ':::media-left',
      '',
      '![Hero](hero.png){width=60%}',
      '',
      'Old copy',
      '',
      ':::',
      '',
      'Outro'
    ].join('\n');

    expect(updateMarkdownMediaBlockText(markdown, 0, 'New copy')).toBe([
      'Intro',
      '',
      ':::media-left',
      '',
      '![Hero](hero.png){width=60%}',
      '',
      'New copy',
      '',
      ':::',
      '',
      'Outro'
    ].join('\n'));
  });

  it('leaves markdown unchanged when the media block cannot be found', () => {
    const markdown = '![Hero](hero.png)';

    expect(updateMarkdownMediaBlockText(markdown, 2, 'Copy')).toBe(markdown);
  });
});

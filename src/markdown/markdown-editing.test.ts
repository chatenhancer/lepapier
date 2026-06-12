import { describe, expect, it } from 'vitest';

import {
  getMarkdownMediaBlockCopyRange,
  toggleOrderedLinePrefix,
  toggleTaskLinePrefix
} from './markdown-editing';

describe('markdown editing helpers', () => {
  it('locates the editable side-text range in media blocks', () => {
    const markdown = [
      'Intro',
      '',
      ':::media-right',
      '',
      '![Hero](hero.png)',
      '',
      'Side copy',
      '',
      'More copy',
      '',
      ':::',
      '',
      'Outro'
    ].join('\n');

    const range = getMarkdownMediaBlockCopyRange(markdown, 0);

    expect(range && markdown.slice(range.start, range.end)).toBe(['Side copy', '', 'More copy'].join('\n'));
  });

  it('returns null when a media block has no side text', () => {
    const markdown = [':::media-left', '', '![Hero](hero.png)', '', ':::'].join('\n');

    expect(getMarkdownMediaBlockCopyRange(markdown, 0)).toBeNull();
  });

  it('toggles ordered list prefixes across selected blocks', () => {
    expect(toggleOrderedLinePrefix('one\ntwo', 0, 'one\ntwo'.length)).toBe('1. one\n2. two');
    expect(toggleOrderedLinePrefix('1. one\n2. two', 0, '1. one\n2. two'.length)).toBe('one\ntwo');
  });

  it('toggles task list prefixes across selected blocks', () => {
    expect(toggleTaskLinePrefix('one\ntwo', 0, 'one\ntwo'.length)).toBe('- [ ] one\n- [ ] two');
    expect(toggleTaskLinePrefix('- [ ] one\n- [x] two', 0, '- [ ] one\n- [x] two'.length)).toBe('one\ntwo');
  });
});

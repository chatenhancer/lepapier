import { describe, expect, it } from 'vitest';
import {
  applyToolbarFormattingToSource,
  createToolbarFormattingSnippet
} from './toolbar-formatting';

describe('toolbar formatting', () => {
  it('creates write-mode snippets', () => {
    expect(createToolbarFormattingSnippet('bold', 'paper')).toBe('**paper**');
    expect(createToolbarFormattingSnippet('list', 'one\ntwo')).toBe('- one\n- two');
    expect(createToolbarFormattingSnippet('code', 'one\ntwo')).toBe('```\none\ntwo\n```');
  });

  it('applies preview-mode formatting to markdown source ranges', () => {
    expect(applyToolbarFormattingToSource('bold', {
      absoluteEnd: 5,
      absoluteStart: 0,
      body: 'paper',
      sourceEnd: 5,
      sourceStart: 0
    })).toBe('**paper**');
    expect(applyToolbarFormattingToSource('quote', {
      absoluteEnd: 5,
      absoluteStart: 0,
      body: 'paper',
      sourceEnd: 5,
      sourceStart: 0
    })).toBe('> paper');
  });
});

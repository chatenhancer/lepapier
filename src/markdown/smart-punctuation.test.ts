import { describe, expect, it } from 'vitest';

import {
  replaceMarkdownProseSmartPunctuation,
  replaceStraightSmartPunctuation
} from './smart-punctuation';

describe('smart punctuation', () => {
  it('replaces straight quotes in plain prose', () => {
    expect(replaceStraightSmartPunctuation('"Hello", it\'s paper')).toBe('«Hello», it’s paper');
  });

  it('skips inline code and fenced code blocks in Markdown', () => {
    expect(replaceMarkdownProseSmartPunctuation('"Hello" `"code"`\n```\n"code fence"\n```\n"Next"')).toBe(
      '«Hello» `"code"`\n```\n"code fence"\n```\n«Next»'
    );
  });
});

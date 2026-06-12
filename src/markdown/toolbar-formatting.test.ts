import { describe, expect, it } from 'vitest';
import {
  applyToolbarFormattingToSource,
  createToolbarFormattingSnippet
} from './toolbar-formatting';

describe('toolbar formatting', () => {
  it('creates write-mode snippets', () => {
    expect(createToolbarFormattingSnippet('bold', 'paper')).toBe('**paper**');
    expect(createToolbarFormattingSnippet('italic', 'paper')).toBe('*paper*');
    expect(createToolbarFormattingSnippet('strike', 'paper')).toBe('~~paper~~');
    expect(createToolbarFormattingSnippet('link', 'paper')).toBe('[paper](https://example.com)');
    expect(createToolbarFormattingSnippet('list', 'one\ntwo')).toBe('- one\n- two');
    expect(createToolbarFormattingSnippet('ordered-list', 'one\ntwo')).toBe('1. one\n2. two');
    expect(createToolbarFormattingSnippet('task-list', 'one\ntwo')).toBe('- [ ] one\n- [ ] two');
    expect(createToolbarFormattingSnippet('quote', 'one\ntwo')).toBe('> one\n> two');
    expect(createToolbarFormattingSnippet('code', 'one\ntwo')).toBe('```\none\ntwo\n```');
    expect(createToolbarFormattingSnippet('rule', '')).toBe('\n\n---\n\n');
    expect(createToolbarFormattingSnippet('table', '')).toBe([
      '',
      '',
      '| Column | Value |',
      '| --- | --- |',
      '| Item | Detail |',
      ''
    ].join('\n'));
  });

  it('applies preview-mode formatting to markdown source ranges', () => {
    expect(applyToolbarFormattingToSource('bold', {
      absoluteEnd: 5,
      absoluteStart: 0,
      body: 'paper',
      sourceEnd: 5,
      sourceStart: 0
    })).toBe('**paper**');
    expect(applyToolbarFormattingToSource('italic', {
      absoluteEnd: 5,
      absoluteStart: 0,
      body: 'paper',
      sourceEnd: 5,
      sourceStart: 0
    })).toBe('*paper*');
    expect(applyToolbarFormattingToSource('code', {
      absoluteEnd: 5,
      absoluteStart: 0,
      body: 'paper',
      sourceEnd: 5,
      sourceStart: 0
    })).toBe('`paper`');
    expect(applyToolbarFormattingToSource('strike', {
      absoluteEnd: 5,
      absoluteStart: 0,
      body: 'paper',
      sourceEnd: 5,
      sourceStart: 0
    })).toBe('~~paper~~');
    expect(applyToolbarFormattingToSource('link', {
      absoluteEnd: 5,
      absoluteStart: 0,
      body: 'paper',
      sourceEnd: 5,
      sourceStart: 0
    })).toBe('[paper](https://example.com)');
    expect(applyToolbarFormattingToSource('heading', {
      absoluteEnd: 5,
      absoluteStart: 0,
      body: 'paper',
      sourceEnd: 5,
      sourceStart: 0
    })).toBe('## paper');
    expect(applyToolbarFormattingToSource('quote', {
      absoluteEnd: 5,
      absoluteStart: 0,
      body: 'paper',
      sourceEnd: 5,
      sourceStart: 0
    })).toBe('> paper');
    expect(applyToolbarFormattingToSource('list', {
      absoluteEnd: 5,
      absoluteStart: 0,
      body: 'paper',
      sourceEnd: 5,
      sourceStart: 0
    })).toBe('- paper');
    expect(applyToolbarFormattingToSource('ordered-list', {
      absoluteEnd: 9,
      absoluteStart: 0,
      body: 'one\ntwo',
      sourceEnd: 7,
      sourceStart: 0
    })).toBe('1. one\n2. two');
    expect(applyToolbarFormattingToSource('task-list', {
      absoluteEnd: 9,
      absoluteStart: 0,
      body: 'one\ntwo',
      sourceEnd: 7,
      sourceStart: 0
    })).toBe('- [ ] one\n- [ ] two');
    expect(applyToolbarFormattingToSource('rule', {
      absoluteEnd: 5,
      absoluteStart: 0,
      body: 'paper',
      sourceEnd: 5,
      sourceStart: 0
    })).toBe('---');
  });

  it('toggles preview-mode formatting off when source already has it', () => {
    expect(applyToolbarFormattingToSource('italic', {
      absoluteEnd: 6,
      absoluteStart: 1,
      body: '*paper*',
      sourceEnd: 7,
      sourceStart: 0
    })).toBe('paper');
    expect(applyToolbarFormattingToSource('bold', {
      absoluteEnd: 7,
      absoluteStart: 2,
      body: '**paper**',
      sourceEnd: 9,
      sourceStart: 0
    })).toBe('paper');
    expect(applyToolbarFormattingToSource('strike', {
      absoluteEnd: 7,
      absoluteStart: 2,
      body: '~~paper~~',
      sourceEnd: 9,
      sourceStart: 0
    })).toBe('paper');
    expect(applyToolbarFormattingToSource('heading', {
      absoluteEnd: 8,
      absoluteStart: 3,
      body: '## paper',
      sourceEnd: 8,
      sourceStart: 0
    })).toBe('paper');
    expect(applyToolbarFormattingToSource('ordered-list', {
      absoluteEnd: 13,
      absoluteStart: 3,
      body: '1. one\n2. two',
      sourceEnd: 13,
      sourceStart: 0
    })).toBe('one\ntwo');
    expect(applyToolbarFormattingToSource('task-list', {
      absoluteEnd: 19,
      absoluteStart: 6,
      body: '- [ ] one\n- [x] two',
      sourceEnd: 19,
      sourceStart: 0
    })).toBe('one\ntwo');
  });
});

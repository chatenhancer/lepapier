import { describe, expect, it } from 'vitest';

import {
  formatPreviewMarkdownBlock,
  getNextPreviewTableCellCoordinates,
  updatePreviewMarkdownBlock,
  updateMarkdownMediaBlockText
} from './preview-text-editor';

describe('preview text editor helpers', () => {
  it('formats edited preview text back to markdown blocks', () => {
    expect(formatPreviewMarkdownBlock('H2', 'Section')).toBe('## Section');
    expect(formatPreviewMarkdownBlock('LI', 'One\nTwo')).toBe('- One\n- Two');
    expect(formatPreviewMarkdownBlock('LI', 'One', { listMarker: '3. ' })).toBe('3. One');
    expect(formatPreviewMarkdownBlock('LI', 'Done', { listMarker: '- [x] ' })).toBe('- [x] Done');
    expect(formatPreviewMarkdownBlock('BLOCKQUOTE', 'One\nTwo')).toBe('> One\n> Two');
    expect(formatPreviewMarkdownBlock('TD', 'One\nTwo | Three')).toBe('One Two \\| Three');
    expect(formatPreviewMarkdownBlock('P', 'One\n\nTwo')).toBe('One\n\nTwo');
  });

  it('saves an emptied preview paragraph back to markdown', () => {
    const markdown = ['Intro', '', 'Delete me', '', 'Outro'].join('\n');
    const start = markdown.indexOf('Delete me');
    const end = start + 'Delete me'.length;

    expect(updatePreviewMarkdownBlock(markdown, sourceElement('P', start, end), '')).toBe(['Intro', '', '', '', 'Outro'].join('\n'));
  });

  it('saves an emptied preview heading back to markdown', () => {
    const markdown = ['# Old', '', 'Next'].join('\n');

    expect(updatePreviewMarkdownBlock(markdown, sourceElement('H1', 0, '# Old'.length), '')).toBe(['', '', 'Next'].join('\n'));
  });

  it('saves edited ordered and task list items with their original markers', () => {
    expect(updatePreviewMarkdownBlock('2. Old', sourceElement('LI', 0, '2. Old'.length), 'New', { listMarker: '2. ' })).toBe('2. New');
    expect(updatePreviewMarkdownBlock('- [ ] Old', sourceElement('LI', 0, '- [ ] Old'.length), 'New', { listMarker: '- [ ] ' })).toBe('- [ ] New');
  });

  it('saves edited table-cell text as escaped Markdown text', () => {
    const markdown = ['| Name | Count |', '| --- | ---: |', '| Paper | 3 |'].join('\n');

    expect(updatePreviewMarkdownBlock(markdown, sourceElement('TD', markdown.indexOf('Paper'), markdown.indexOf('Paper') + 'Paper'.length), 'Card | stock')).toBe([
      '| Name | Count |',
      '| --- | ---: |',
      '| Card \\| stock | 3 |'
    ].join('\n'));
  });

  it('leaves inline markdown unchanged when rendered preview text did not change', () => {
    const markdown = 'This keeps *italic* and **bold** text plus [a link](https://example.com).';

    expect(updatePreviewMarkdownBlock(
      markdown,
      sourceElement('P', 0, markdown.length),
      'This keeps italic and bold text plus a link.'
    )).toBe(markdown);
  });

  it('preserves inline markdown produced from edited preview DOM', () => {
    const markdown = 'This keeps *italic* text.';

    expect(updatePreviewMarkdownBlock(
      markdown,
      sourceElement('P', 0, markdown.length),
      'This keeps *italic* text.\nNew paragraph.'
    )).toBe('This keeps *italic* text.\n\nNew paragraph.');
  });

  it('finds the next editable table cell in visual order', () => {
    const cells = [
      { rowIndex: 0, columnIndex: 0 },
      { rowIndex: 0, columnIndex: 1 },
      { rowIndex: 1, columnIndex: 0 },
      { rowIndex: 1, columnIndex: 1 }
    ];

    expect(getNextPreviewTableCellCoordinates(cells, { rowIndex: 0, columnIndex: 1 }, 1)).toEqual({ rowIndex: 1, columnIndex: 0 });
    expect(getNextPreviewTableCellCoordinates(cells, { rowIndex: 1, columnIndex: 0 }, -1)).toEqual({ rowIndex: 0, columnIndex: 1 });
    expect(getNextPreviewTableCellCoordinates(cells, { rowIndex: 1, columnIndex: 1 }, 1)).toBeNull();
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

  it('keeps media block markdown unchanged when serialized side text is unchanged', () => {
    const markdown = [
      ':::media-right',
      '',
      '![Hero](hero.png)',
      '',
      '## Built for replays',
      '',
      '*HELP-A-FRIEND! Trivia* keeps emphasis.',
      '',
      ':::'
    ].join('\n');

    expect(updateMarkdownMediaBlockText(
      markdown,
      0,
      [
        '## Built for replays',
        '',
        '*HELP-A-FRIEND! Trivia* keeps emphasis.'
      ].join('\n')
    )).toBe(markdown);
  });

  it('updates media side text as multiline markdown without touching block markers', () => {
    const markdown = [
      ':::media-right',
      '',
      '![Hero](hero.png)',
      '',
      'Old copy',
      '',
      ':::'
    ].join('\n');

    expect(updateMarkdownMediaBlockText(
      markdown,
      0,
      [
        'New copy',
        '',
        '## Built for replays',
        '',
        '*HELP-A-FRIEND! Trivia* keeps emphasis.'
      ].join('\n')
    )).toBe([
      ':::media-right',
      '',
      '![Hero](hero.png)',
      '',
      'New copy',
      '',
      '## Built for replays',
      '',
      '*HELP-A-FRIEND! Trivia* keeps emphasis.',
      '',
      ':::'
    ].join('\n'));
  });

  it('leaves markdown unchanged when the media block cannot be found', () => {
    const markdown = '![Hero](hero.png)';

    expect(updateMarkdownMediaBlockText(markdown, 2, 'Copy')).toBe(markdown);
  });
});

function sourceElement(
  tagName: string,
  sourceStart: number,
  sourceEnd: number
): { dataset: { sourceEnd: string; sourceStart: string }; tagName: string } {
  return {
    dataset: {
      sourceEnd: String(sourceEnd),
      sourceStart: String(sourceStart)
    },
    tagName
  };
}

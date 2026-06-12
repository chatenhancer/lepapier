import { describe, expect, it } from 'vitest';

import {
  formatPreviewMarkdownBlock,
  insertPreviewTableColumn,
  insertPreviewTableRow,
  updatePreviewTableCell,
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

    expect(updatePreviewMarkdownBlock(markdown, start, end, 'P', '')).toBe(['Intro', '', '', '', 'Outro'].join('\n'));
  });

  it('saves an emptied preview heading back to markdown', () => {
    const markdown = ['# Old', '', 'Next'].join('\n');

    expect(updatePreviewMarkdownBlock(markdown, 0, '# Old'.length, 'H1', '')).toBe(['', '', 'Next'].join('\n'));
  });

  it('saves edited ordered and task list items with their original markers', () => {
    expect(updatePreviewMarkdownBlock('2. Old', 0, '2. Old'.length, 'LI', 'New', { listMarker: '2. ' })).toBe('2. New');
    expect(updatePreviewMarkdownBlock('- [ ] Old', 0, '- [ ] Old'.length, 'LI', 'New', { listMarker: '- [ ] ' })).toBe('- [ ] New');
  });

  it('saves edited table cells back into the markdown row', () => {
    const markdown = ['| Name | Count |', '| --- | ---: |', '| Paper | 3 |'].join('\n');

    expect(updatePreviewMarkdownBlock(markdown, markdown.indexOf('Paper'), markdown.indexOf('Paper') + 'Paper'.length, 'TD', 'Card')).toBe([
      '| Name | Count |',
      '| --- | ---: |',
      '| Card | 3 |'
    ].join('\n'));
  });

  it('saves edited table cells by replacing the parsed table block', () => {
    const markdown = ['Intro', '', '| Name | Count |', '| --- | ---: |', '| Paper | 3 |', '', 'Outro'].join('\n');
    const tableStart = markdown.indexOf('| Name');
    const tableEnd = markdown.indexOf('\n\nOutro');

    expect(updatePreviewTableCell(markdown, tableStart, tableEnd, 1, 0, 'TD', 'Card | stock')).toBe([
      'Intro',
      '',
      '| Name | Count |',
      '| --- | ---: |',
      '| Card \\| stock | 3 |',
      '',
      'Outro'
    ].join('\n'));
  });

  it('adds a preview table row after the active row', () => {
    const markdown = [
      'Intro',
      '',
      '| Name | Count |',
      '| --- | ---: |',
      '| Paper | 3 |',
      '| Pen | 8 |',
      '',
      'Outro'
    ].join('\n');
    const tableStart = markdown.indexOf('| Name');
    const tableEnd = markdown.indexOf('\n\nOutro');

    expect(insertPreviewTableRow(markdown, tableStart, tableEnd, 1)).toBe([
      'Intro',
      '',
      '| Name | Count |',
      '| --- | ---: |',
      '| Paper | 3 |',
      '|  |  |',
      '| Pen | 8 |',
      '',
      'Outro'
    ].join('\n'));
  });

  it('adds a preview table column after the active column', () => {
    const markdown = ['| Name | Count |', '| --- | ---: |', '| Paper | 3 |'].join('\n');

    expect(insertPreviewTableColumn(markdown, 0, markdown.length, 0)).toBe([
      '| Name | Column | Count |',
      '| --- | --- | ---: |',
      '| Paper |  | 3 |'
    ].join('\n'));
  });

  it('adds a row after committing a pending table cell edit', () => {
    const markdown = ['| Name | Count |', '| --- | ---: |', '| Paper | 3 |', '| Pen | 8 |'].join('\n');
    const edited = updatePreviewTableCell(markdown, 0, markdown.length, 1, 0, 'TD', 'Notebook');
    const adjustedEnd = markdown.length + (edited.length - markdown.length);

    expect(insertPreviewTableRow(edited, 0, adjustedEnd, 1)).toBe([
      '| Name | Count |',
      '| --- | ---: |',
      '| Notebook | 3 |',
      '|  |  |',
      '| Pen | 8 |'
    ].join('\n'));
  });

  it('adds a column after committing a pending table cell edit', () => {
    const markdown = ['| Name | Count |', '| --- | ---: |', '| Paper | 3 |'].join('\n');
    const edited = updatePreviewTableCell(markdown, 0, markdown.length, 1, 1, 'TD', '12');
    const adjustedEnd = markdown.length + (edited.length - markdown.length);

    expect(insertPreviewTableColumn(edited, 0, adjustedEnd, 1)).toBe([
      '| Name | Count | Column |',
      '| --- | ---: | --- |',
      '| Paper | 12 |  |'
    ].join('\n'));
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

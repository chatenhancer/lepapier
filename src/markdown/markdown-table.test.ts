import { describe, expect, it } from 'vitest';

import {
  findMarkdownTables,
  getMarkdownLineStarts,
  insertMarkdownTableColumn,
  insertMarkdownTableRow,
  parseMarkdownTableAt,
  updateMarkdownTableCell
} from './markdown-table';

describe('markdown table helpers', () => {
  it('parses table source ranges and alignments', () => {
    const markdown = [
      'Intro',
      '',
      '| Name | Count |',
      '| :--- | ---: |',
      '| Paper | 3 |'
    ].join('\n');
    const lines = markdown.split('\n');
    const table = parseMarkdownTableAt(lines, getMarkdownLineStarts(markdown), 2, 0);

    expect(table?.start).toBe(markdown.indexOf('| Name'));
    expect(table?.end).toBe(markdown.length);
    expect(table?.alignments).toEqual(['left', 'right']);
    expect(table?.header.map((cell) => cell.text)).toEqual(['Name', 'Count']);
    expect(table?.rows[0].map((cell) => cell.text)).toEqual(['Paper', '3']);
  });

  it('finds tables outside code and media blocks', () => {
    const markdown = [
      '```',
      '| Hidden | Table |',
      '| --- | --- |',
      '```',
      '',
      ':::media-right',
      '| Hidden | Media |',
      '| --- | --- |',
      ':::',
      '',
      '| Visible | Table |',
      '| --- | --- |',
      '| A | B |'
    ].join('\n');

    const tables = findMarkdownTables(markdown);

    expect(tables).toHaveLength(1);
    expect(tables[0].header.map((cell) => cell.text)).toEqual(['Visible', 'Table']);
  });

  it('saves edited table cells by table index', () => {
    const markdown = ['Intro', '', '| Name | Count |', '| --- | ---: |', '| Paper | 3 |', '', 'Outro'].join('\n');

    expect(updateMarkdownTableCell(markdown, 0, 1, 0, 'Card | stock')).toBe([
      'Intro',
      '',
      '| Name | Count |',
      '| --- | ---: |',
      '| Card \\| stock | 3 |',
      '',
      'Outro'
    ].join('\n'));
  });

  it('edits the requested table when multiple tables exist', () => {
    const markdown = [
      '| First | Table |',
      '| --- | --- |',
      '| A | B |',
      '',
      '| Second | Table |',
      '| --- | --- |',
      '| C | D |'
    ].join('\n');

    expect(updateMarkdownTableCell(markdown, 1, 1, 1, 'Done')).toBe([
      '| First | Table |',
      '| --- | --- |',
      '| A | B |',
      '',
      '| Second | Table |',
      '| --- | --- |',
      '| C | Done |'
    ].join('\n'));
  });

  it('keeps the divider valid when a body row has extra pipe characters', () => {
    const markdown = [
      '| Column | Value |  |  |',
      '| --- | --- | --- | --- |',
      '| Item | Detail |  |  |||'
    ].join('\n');

    expect(updateMarkdownTableCell(markdown, 0, 0, 1, 'Value1')).toBe([
      '| Column | Value1 |  |  |',
      '| --- | --- | --- | --- |',
      '| Item | Detail |  |  |'
    ].join('\n'));
  });

  it('removes hidden trailing cell fragments from the edited table row', () => {
    const cleanPrefix = [
      '| Column1 | Value2 | Column |',
      '| --- | --- | --- |',
      '| Item3 | Detail4 | Col1 |',
      '| Item5 | Detail6 | col2 |',
      '|  |  | col3 |'
    ].join('\n');
    const markdown = `${cleanPrefix}l3 |l3 |`;

    expect(updateMarkdownTableCell(markdown, 0, 3, 2, 'col3')).toBe(cleanPrefix);
  });

  it('adds a table row after the active rendered row', () => {
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

    expect(insertMarkdownTableRow(markdown, 0, 1)).toBe([
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

  it('adds a table column after the active column', () => {
    const markdown = ['| Name | Count |', '| --- | ---: |', '| Paper | 3 |'].join('\n');

    expect(insertMarkdownTableColumn(markdown, 0, 0)).toBe([
      '| Name | Column | Count |',
      '| --- | --- | ---: |',
      '| Paper |  | 3 |'
    ].join('\n'));
  });

  it('adds a row after committing a pending table cell edit', () => {
    const markdown = ['| Name | Count |', '| --- | ---: |', '| Paper | 3 |', '| Pen | 8 |'].join('\n');
    const edited = updateMarkdownTableCell(markdown, 0, 1, 0, 'Notebook');

    expect(insertMarkdownTableRow(edited, 0, 1)).toBe([
      '| Name | Count |',
      '| --- | ---: |',
      '| Notebook | 3 |',
      '|  |  |',
      '| Pen | 8 |'
    ].join('\n'));
  });

  it('adds a column after committing a pending table cell edit', () => {
    const markdown = ['| Name | Count |', '| --- | ---: |', '| Paper | 3 |'].join('\n');
    const edited = updateMarkdownTableCell(markdown, 0, 1, 1, '12');

    expect(insertMarkdownTableColumn(edited, 0, 1)).toBe([
      '| Name | Count | Column |',
      '| --- | ---: | --- |',
      '| Paper | 12 |  |'
    ].join('\n'));
  });
});

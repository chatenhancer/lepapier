export type MarkdownTableAlignment = '' | 'center' | 'left' | 'right';

export interface MarkdownTableCell {
  end: number;
  markdown: string;
  start: number;
  text: string;
}

export interface MarkdownTable {
  alignments: MarkdownTableAlignment[];
  columnCount: number;
  end: number;
  endIndex: number;
  header: MarkdownTableCell[];
  index: number;
  markdownRows: string[][];
  rows: MarkdownTableCell[][];
  start: number;
  startIndex: number;
}

export function getMarkdownLineStarts(markdown: string): number[] {
  const starts: number[] = [];
  let offset = 0;
  for (const line of String(markdown || '').split('\n')) {
    starts.push(offset);
    offset += line.length + 1;
  }
  return starts;
}

export function parseMarkdownTableAt(
  lines: string[],
  lineStarts: number[],
  startIndex: number,
  tableIndex = 0
): MarkdownTable | null {
  const headerCells = splitMarkdownTableRow(lines[startIndex], lineStarts[startIndex] || 0);
  const alignments = parseMarkdownTableDivider(lines[startIndex + 1]);
  if (!headerCells || !alignments || headerCells.length !== alignments.length) return null;

  const columnCount = headerCells.length;
  const dividerCells = normalizeMarkdownTableCells(
    splitMarkdownTableRow(lines[startIndex + 1], lineStarts[startIndex + 1] || 0) || [],
    columnCount
  );
  const rows: MarkdownTableCell[][] = [];
  let endIndex = startIndex + 1;

  for (let rowIndex = startIndex + 2; rowIndex < lines.length; rowIndex += 1) {
    const rowCells = splitMarkdownTableRow(lines[rowIndex], lineStarts[rowIndex] || 0);
    if (!rowCells) break;
    rows.push(normalizeMarkdownTableCells(rowCells, columnCount));
    endIndex = rowIndex;
  }

  const header = normalizeMarkdownTableCells(headerCells, columnCount);
  const start = lineStarts[startIndex] || 0;
  const end = (lineStarts[endIndex] || 0) + lines[endIndex].length;

  return {
    alignments,
    columnCount,
    end,
    endIndex,
    header,
    index: tableIndex,
    markdownRows: [
      getMarkdownTableRowValues(header),
      getMarkdownTableRowValues(dividerCells),
      ...rows.map(getMarkdownTableRowValues)
    ],
    rows,
    start,
    startIndex
  };
}

export function findMarkdownTables(markdown: string): MarkdownTable[] {
  const source = String(markdown || '');
  const lines = source.split('\n');
  const lineStarts = getMarkdownLineStarts(source);
  const tables: MarkdownTable[] = [];
  let inCode = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (line.startsWith('```')) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;

    if (getMarkdownMediaBlockDirection(line.trim())) {
      while (index < lines.length && lines[index].trim() !== ':::') {
        index += 1;
      }
      continue;
    }

    const table = parseMarkdownTableAt(lines, lineStarts, index, tables.length);
    if (!table) continue;

    tables.push(table);
    index = table.endIndex;
  }

  return tables;
}

export function updateMarkdownTableCell(
  markdown: string,
  tableIndex: number,
  renderedRowIndex: number,
  columnIndex: number,
  text: string
): string {
  const table = findMarkdownTables(markdown)[tableIndex];
  if (!table) return markdown;

  const markdownRowIndex = renderedTableRowIndexToMarkdownRowIndex(renderedRowIndex);
  if (
    markdownRowIndex < 0
    || columnIndex < 0
    || markdownRowIndex >= table.markdownRows.length
    || columnIndex >= table.columnCount
  ) {
    return markdown;
  }

  const rows = cloneMarkdownTableRows(table);
  rows[markdownRowIndex][columnIndex] = formatMarkdownTableCellText(text);

  return replaceMarkdownRange(markdown, table.start, table.end, formatMarkdownTableRows(rows));
}

export function insertMarkdownTableRow(
  markdown: string,
  tableIndex: number,
  afterRenderedRowIndex: number | null = null
): string {
  const table = findMarkdownTables(markdown)[tableIndex];
  if (!table) return markdown;

  const row = Array.from({ length: table.columnCount }, () => '');
  const insertIndex = Number.isInteger(afterRenderedRowIndex)
    ? Math.min(table.markdownRows.length, Math.max(2, Number(afterRenderedRowIndex) + 2))
    : table.markdownRows.length;
  const rows = cloneMarkdownTableRows(table);
  rows.splice(insertIndex, 0, row);

  return replaceMarkdownRange(markdown, table.start, table.end, formatMarkdownTableRows(rows));
}

export function insertMarkdownTableColumn(
  markdown: string,
  tableIndex: number,
  afterColumnIndex: number | null = null
): string {
  const table = findMarkdownTables(markdown)[tableIndex];
  if (!table) return markdown;

  const insertIndex = Number.isInteger(afterColumnIndex)
    ? clamp(Number(afterColumnIndex) + 1, 0, table.columnCount)
    : table.columnCount;
  const rows = cloneMarkdownTableRows(table);

  rows.forEach((row, rowIndex) => {
    row.splice(insertIndex, 0, rowIndex === 0 ? 'Column' : rowIndex === 1 ? '---' : '');
  });

  return replaceMarkdownRange(markdown, table.start, table.end, formatMarkdownTableRows(rows));
}

export function formatMarkdownTableCellText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
}

export function formatMarkdownTableRows(rows: string[][]): string {
  return rows.map(formatMarkdownTableRow).join('\n');
}

function splitMarkdownTableRow(line: string | undefined, lineStart = 0): MarkdownTableCell[] | null {
  if (!line || !line.includes('|')) return null;

  const trimmedStart = line.search(/\S/);
  if (trimmedStart < 0) return null;

  let contentStart = trimmedStart;
  let contentEnd = line.length - (/\s*$/.exec(line)?.[0].length || 0);
  if (line[contentStart] === '|') contentStart += 1;
  if (line[contentEnd - 1] === '|') contentEnd -= 1;

  const cells: MarkdownTableCell[] = [];
  let cellStart = contentStart;
  for (let cursor = contentStart; cursor <= contentEnd; cursor += 1) {
    if (cursor < contentEnd && (line[cursor] !== '|' || line[cursor - 1] === '\\')) continue;

    cells.push(createMarkdownTableCell(line, lineStart, cellStart, cursor));
    cellStart = cursor + 1;
  }

  return cells.length > 1 ? cells : null;
}

function parseMarkdownTableDivider(line: string | undefined): MarkdownTableAlignment[] | null {
  const cells = splitMarkdownTableRow(line);
  if (!cells) return null;

  const alignments: MarkdownTableAlignment[] = [];
  for (const cell of cells) {
    const value = cell.markdown.replace(/\s+/g, '');
    if (!isMarkdownTableDividerCell(value)) return null;

    const alignsLeft = value.startsWith(':');
    const alignsRight = value.endsWith(':');
    if (alignsLeft && alignsRight) {
      alignments.push('center');
    } else if (alignsRight) {
      alignments.push('right');
    } else if (alignsLeft) {
      alignments.push('left');
    } else {
      alignments.push('');
    }
  }

  return alignments;
}

function isMarkdownTableDividerCell(value: string): boolean {
  return /^:?-{3,}:?$/.test(value);
}

function normalizeMarkdownTableCells(cells: MarkdownTableCell[], length: number): MarkdownTableCell[] {
  return Array.from({ length }, (_value, index) => cells[index] || createEmptyMarkdownTableCell(cells[cells.length - 1]));
}

function createMarkdownTableCell(line: string, lineStart: number, start: number, end: number): MarkdownTableCell {
  const raw = line.slice(start, end);
  const leadingWhitespace = raw.search(/\S/);
  const contentStart = leadingWhitespace < 0 ? start : start + leadingWhitespace;
  const trailingWhitespace = /\s*$/.exec(raw)?.[0].length || 0;
  const contentEnd = Math.max(contentStart, end - trailingWhitespace);
  const markdown = line.slice(contentStart, contentEnd);

  return {
    end: lineStart + contentEnd,
    markdown,
    start: lineStart + contentStart,
    text: markdown.replace(/\\\|/g, '|')
  };
}

function createEmptyMarkdownTableCell(previousCell: MarkdownTableCell | undefined): MarkdownTableCell {
  const offset = previousCell?.end || 0;
  return {
    end: offset,
    markdown: '',
    start: offset,
    text: ''
  };
}

function getMarkdownTableRowValues(cells: MarkdownTableCell[]): string[] {
  return cells.map((cell) => cell.markdown);
}

function cloneMarkdownTableRows(table: MarkdownTable): string[][] {
  return table.markdownRows.map((row) => [...row]);
}

function renderedTableRowIndexToMarkdownRowIndex(rowIndex: number): number {
  return rowIndex <= 0 ? 0 : rowIndex + 1;
}

function formatMarkdownTableRow(cells: string[]): string {
  return `| ${cells.map((cell) => cell.trim()).join(' | ')} |`;
}

function replaceMarkdownRange(markdown: string, start: number, end: number, replacement: string): string {
  return `${markdown.slice(0, start)}${replacement}${markdown.slice(end)}`;
}

function getMarkdownMediaBlockDirection(line: string): 'left' | 'right' | null {
  if (line === ':::media-right') return 'right';
  if (line === ':::media-left') return 'left';
  return null;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

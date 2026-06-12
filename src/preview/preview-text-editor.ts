import {
  getMarkdownImageMatch,
  getMediaBlockDirection,
  replaceSourceRange
} from '../markdown/markdown-editing';
import { replaceStraightSmartPunctuation } from '../markdown/smart-punctuation';
import type { DocumentFields } from '../shared/types';
import { slugify } from '../shared/text';

type PreviewTextFieldName = Extract<keyof DocumentFields, 'description' | 'title'>;
type WritableFieldName = Extract<keyof DocumentFields, 'body' | 'description' | 'slug' | 'tags' | 'title'>;

export interface PreviewTextEditor {
  attach(): void;
}

export interface PreviewTextEditorOptions {
  getBody(): string;
  getFieldValue(name: keyof DocumentFields): string;
  isSlugEdited(): boolean;
  isSmartPunctuationEnabled(): boolean;
  markDescriptionEdited(): void;
  markTagsEdited(): void;
  markTitleEdited(): void;
  preview: HTMLElement;
  recordHistory(): void;
  scheduleMetadata(): void;
  setFieldValue(name: WritableFieldName, value: string): void;
  sync(): void;
}

export function setupPreviewTextEditor({
  getBody,
  getFieldValue,
  isSlugEdited,
  isSmartPunctuationEnabled,
  markDescriptionEdited,
  markTagsEdited,
  markTitleEdited,
  preview,
  recordHistory,
  scheduleMetadata,
  setFieldValue,
  sync
}: PreviewTextEditorOptions): PreviewTextEditor {
  let activeTableCell: HTMLElement | null = null;

  const normalizePreviewEditedText = (value: string) => {
    const text = String(value || '').replace(/\u00a0/g, ' ').trim();
    return isSmartPunctuationEnabled() ? replaceStraightSmartPunctuation(text) : text;
  };

  const makePreviewTextEditable = (element: HTMLElement) => {
    element.contentEditable = 'true';
    element.spellcheck = true;
    element.dataset.previewEditable = 'true';
    element.setAttribute('role', 'textbox');
    element.setAttribute('aria-label', 'Edit text');

    element.addEventListener('beforeinput', () => {
      if (element.dataset.editing === 'true') return;
      recordHistory();
      element.dataset.editing = 'true';
    });
    element.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.shiftKey) return;
      event.preventDefault();
      element.blur();
    });
    element.addEventListener('paste', (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text/plain');
      if (!text) return;

      event.preventDefault();
      insertPlainTextAtSelection(text);
    });
  };

  const updatePreviewFieldText = (element: HTMLElement) => {
    const fieldName = element.dataset.previewField;
    if (fieldName !== 'title' && fieldName !== 'description') return;
    const editorFieldName = fieldName as PreviewTextFieldName;

    const nextText = normalizePreviewEditedText(element.innerText);
    if (getFieldValue(editorFieldName) !== nextText) {
      setFieldValue(editorFieldName, nextText);
      if (editorFieldName === 'title') {
        markTitleEdited();
        if (!isSlugEdited()) {
          setFieldValue('slug', slugify(nextText));
        }
      } else {
        markDescriptionEdited();
      }
      sync();
      scheduleMetadata();
    }

    delete element.dataset.editing;
  };

  const updatePreviewTagsText = () => {
    const tagElements = Array.from(preview.querySelectorAll<HTMLElement>('[data-preview-tags] li'));
    const nextTags = tagElements
      .map((element) => normalizePreviewEditedText(element.innerText))
      .filter(Boolean)
      .join(', ');
    if (getFieldValue('tags') !== nextTags) {
      setFieldValue('tags', nextTags);
      markTagsEdited();
      sync();
      scheduleMetadata();
    }

    for (const element of tagElements) {
      delete element.dataset.editing;
    }
  };

  const commitPreviewMarkdownText = (
    element: HTMLElement,
    { syncAfter = true }: { syncAfter?: boolean } = {}
  ): { body: string; changed: boolean; diff: number } => {
    const sourceStart = Number(element.dataset.sourceStart);
    const sourceEnd = Number(element.dataset.sourceEnd);
    const body = getBody();
    if (!Number.isInteger(sourceStart) || !Number.isInteger(sourceEnd)) {
      return { body, changed: false, diff: 0 };
    }

    const nextText = normalizePreviewEditedText(element.innerText);
    const updatedBody = updatePreviewMarkdownBlock(body, sourceStart, sourceEnd, element.tagName, nextText, {
      listMarker: element.dataset.listMarker
    });
    if (updatedBody !== body) {
      setFieldValue('body', updatedBody);
      if (syncAfter) {
        sync();
        scheduleMetadata();
      }
    }

    delete element.dataset.editing;
    return {
      body: updatedBody,
      changed: updatedBody !== body,
      diff: updatedBody.length - body.length
    };
  };

  const updatePreviewMarkdownText = (element: HTMLElement) => {
    commitPreviewMarkdownText(element);
  };

  const setActiveTableCell = (element: HTMLElement) => {
    activeTableCell = element;
    const table = element.closest<HTMLElement>('.preview-table-scroll');
    if (!table) return;

    table.dataset.activeRow = element.dataset.tableRow || '';
    table.dataset.activeColumn = element.dataset.tableColumn || '';
  };

  const getActiveTableCell = (table: HTMLElement) => (
    activeTableCell?.closest('.preview-table-scroll') === table ? activeTableCell : null
  );

  const updatePreviewTable = (table: HTMLElement, action: 'column' | 'row') => {
    let tableStart = Number(table.dataset.tableStart);
    let tableEnd = Number(table.dataset.tableEnd);
    if (!Number.isInteger(tableStart) || !Number.isInteger(tableEnd)) return;

    recordHistory();

    const cell = getActiveTableCell(table);
    let body = getBody();
    if (cell?.dataset.editing === 'true') {
      const commit = commitPreviewMarkdownText(cell, { syncAfter: false });
      body = commit.body;
      tableEnd += commit.diff;
    }

    const rowIndex = parseTableActionIndex(cell?.dataset.tableRow);
    const columnIndex = parseTableActionIndex(cell?.dataset.tableColumn);
    const updatedBody = action === 'row'
      ? insertPreviewTableRow(body, tableStart, tableEnd, rowIndex)
      : insertPreviewTableColumn(body, tableStart, tableEnd, columnIndex);

    if (updatedBody === body) return;

    setFieldValue('body', updatedBody);
    sync();
    scheduleMetadata();
  };

  const attachPreviewTableEditing = () => {
    for (const table of preview.querySelectorAll<HTMLElement>('.preview-table-scroll[data-table-start][data-table-end]')) {
      const controls = table.ownerDocument.createElement('div');
      const rowButton = table.ownerDocument.createElement('button');
      const columnButton = table.ownerDocument.createElement('button');

      controls.className = 'preview-table-controls';
      controls.contentEditable = 'false';
      controls.addEventListener('pointerdown', (event) => {
        event.preventDefault();
      });

      rowButton.type = 'button';
      rowButton.className = 'preview-table-control';
      rowButton.textContent = 'Add row';
      rowButton.addEventListener('click', () => {
        updatePreviewTable(table, 'row');
      });

      columnButton.type = 'button';
      columnButton.className = 'preview-table-control';
      columnButton.textContent = 'Add column';
      columnButton.addEventListener('click', () => {
        updatePreviewTable(table, 'column');
      });

      controls.append(rowButton, columnButton);
      table.prepend(controls);
    }
  };

  const attachPreviewTextEditing = () => {
    for (const element of preview.querySelectorAll<HTMLElement>('[data-preview-field]')) {
      makePreviewTextEditable(element);
      element.addEventListener('blur', () => {
        updatePreviewFieldText(element);
      });
    }

    for (const element of preview.querySelectorAll<HTMLElement>('[data-preview-tags] li')) {
      makePreviewTextEditable(element);
      element.addEventListener('blur', updatePreviewTagsText);
    }

    for (const element of preview.querySelectorAll<HTMLElement>('.preview-body [data-source-start][data-source-end]')) {
      if (element.closest('[data-media-copy]')) continue;
      if (element.querySelector('.preview-image-frame')) continue;

      makePreviewTextEditable(element);
      if (element.dataset.tableRow !== undefined && element.dataset.tableColumn !== undefined) {
        element.addEventListener('focus', () => {
          setActiveTableCell(element);
        });
        element.addEventListener('pointerdown', () => {
          setActiveTableCell(element);
        });
      }
      element.addEventListener('blur', () => {
        updatePreviewMarkdownText(element);
      });
    }
  };

  const attachMediaTextEditing = () => {
    for (const copy of preview.querySelectorAll<HTMLElement>('[data-media-copy]')) {
      makePreviewTextEditable(copy);
      copy.addEventListener('focus', () => {
        if (!copy.classList.contains('is-placeholder')) return;
        copy.classList.remove('is-placeholder');
        copy.textContent = '';
      }, { once: true });

      copy.addEventListener('blur', () => {
        const updatedBody = updateMarkdownMediaBlockText(
          getBody(),
          Number(copy.dataset.mediaIndex),
          normalizePreviewEditedText(copy.innerText)
        );
        if (updatedBody === getBody()) return;

        recordHistory();
        setFieldValue('body', updatedBody);
        sync();
      });
    }
  };

  return {
    attach() {
      attachPreviewTextEditing();
      attachMediaTextEditing();
      attachPreviewTableEditing();
    }
  };
}

export function formatPreviewMarkdownBlock(
  tagName: string,
  text: string,
  { listMarker = '- ' }: { listMarker?: string } = {}
): string {
  if (!text) return '';

  const normalizedTagName = tagName.toLowerCase();
  if (normalizedTagName === 'h1') return `# ${text}`;
  if (normalizedTagName === 'h2') return `## ${text}`;
  if (normalizedTagName === 'h3') return `### ${text}`;
  if (normalizedTagName === 'li') {
    return text.split('\n').filter(Boolean).map((line) => `${listMarker}${line}`).join('\n');
  }
  if (normalizedTagName === 'blockquote') {
    return text.split('\n').filter(Boolean).map((line) => `> ${line}`).join('\n');
  }
  if (normalizedTagName === 'td' || normalizedTagName === 'th') {
    return text.replace(/\s+/g, ' ').trim().replace(/\|/g, '\\|');
  }
  return text.split('\n').filter(Boolean).join('\n\n');
}

export function updatePreviewMarkdownBlock(
  markdown: string,
  sourceStart: number,
  sourceEnd: number,
  tagName: string,
  text: string,
  options?: { listMarker?: string }
): string {
  const replacement = formatPreviewMarkdownBlock(tagName, text, options);
  if (markdown.slice(sourceStart, sourceEnd) === replacement) return markdown;
  return replaceSourceRange(markdown, sourceStart, sourceEnd, () => replacement);
}

export function insertPreviewTableRow(
  markdown: string,
  tableStart: number,
  tableEnd: number,
  afterRowIndex: number | null = null
): string {
  const table = parsePreviewTable(markdown, tableStart, tableEnd);
  if (!table) return markdown;

  const row = Array.from({ length: table.columnCount }, () => '');
  const insertIndex = Number.isInteger(afterRowIndex)
    ? Math.min(table.rows.length, Math.max(2, Number(afterRowIndex) + 2))
    : table.rows.length;
  const rows = [...table.rows];
  rows.splice(insertIndex, 0, row);

  return replaceSourceRange(markdown, tableStart, tableEnd, () => formatPreviewTableRows(rows));
}

export function insertPreviewTableColumn(
  markdown: string,
  tableStart: number,
  tableEnd: number,
  afterColumnIndex: number | null = null
): string {
  const table = parsePreviewTable(markdown, tableStart, tableEnd);
  if (!table) return markdown;

  const insertIndex = Number.isInteger(afterColumnIndex)
    ? clamp(Number(afterColumnIndex) + 1, 0, table.columnCount)
    : table.columnCount;
  const rows = table.rows.map((row, rowIndex) => {
    const cells = [...normalizePreviewTableCells(row, table.columnCount)];
    cells.splice(insertIndex, 0, rowIndex === 0 ? 'Column' : rowIndex === 1 ? '---' : '');
    return cells;
  });

  return replaceSourceRange(markdown, tableStart, tableEnd, () => formatPreviewTableRows(rows));
}

export function updateMarkdownMediaBlockText(markdown: string, mediaIndex: number, text: string): string {
  if (!Number.isInteger(mediaIndex)) return markdown;

  const lines = markdown.split('\n');
  let currentMediaIndex = -1;

  for (let index = 0; index < lines.length; index += 1) {
    const direction = getMediaBlockDirection(lines[index].trim());
    if (!direction) continue;

    currentMediaIndex += 1;
    const startIndex = index;
    let endIndex = index + 1;
    while (endIndex < lines.length && lines[endIndex].trim() !== ':::') {
      endIndex += 1;
    }
    if (currentMediaIndex !== mediaIndex) {
      index = endIndex;
      continue;
    }

    const blockLines = lines.slice(startIndex + 1, endIndex);
    const imageLine = blockLines.find((line) => getMarkdownImageMatch(line.trim()));
    if (!imageLine) return markdown;

    const nextBlockLines = [`:::media-${direction}`, '', imageLine.trim()];
    if (text) {
      nextBlockLines.push('', ...text.split('\n'));
    }
    nextBlockLines.push('');
    nextBlockLines.push(':::');
    lines.splice(startIndex, endIndex - startIndex + 1, ...nextBlockLines);
    return lines.join('\n');
  }

  return markdown;
}

function parseTableActionIndex(value: string | undefined): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : null;
}

function parsePreviewTable(markdown: string, tableStart: number, tableEnd: number): { columnCount: number; rows: string[][] } | null {
  if (!Number.isInteger(tableStart) || !Number.isInteger(tableEnd) || tableStart < 0 || tableEnd <= tableStart) {
    return null;
  }

  const rows = markdown
    .slice(tableStart, tableEnd)
    .split('\n')
    .map(splitPreviewTableRow);

  if (rows.length < 2 || rows.some((row) => !row)) return null;

  const divider = rows[1];
  if (!divider?.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, '')))) return null;

  const columnCount = Math.max(...rows.map((row) => row?.length || 0));
  if (columnCount < 2) return null;

  return {
    columnCount,
    rows: rows.map((row) => normalizePreviewTableCells(row || [], columnCount))
  };
}

function splitPreviewTableRow(line: string): string[] | null {
  if (!line.includes('|')) return null;

  let source = line.trim();
  if (source.startsWith('|')) source = source.slice(1);
  if (source.endsWith('|')) source = source.slice(0, -1);

  const cells: string[] = [];
  let cell = '';
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '|' && source[index - 1] !== '\\') {
      cells.push(cell.trim());
      cell = '';
      continue;
    }

    cell += character;
  }
  cells.push(cell.trim());

  return cells.length > 1 ? cells : null;
}

function normalizePreviewTableCells(cells: string[], length: number): string[] {
  return Array.from({ length }, (_value, index) => cells[index] || '');
}

function formatPreviewTableRows(rows: string[][]): string {
  return rows.map(formatPreviewTableRow).join('\n');
}

function formatPreviewTableRow(cells: string[]): string {
  return `| ${cells.map((cell) => cell.trim()).join(' | ')} |`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function insertPlainTextAtSelection(text: string): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  selection.deleteFromDocument();
  const textNode = document.createTextNode(text);
  const range = selection.getRangeAt(0);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

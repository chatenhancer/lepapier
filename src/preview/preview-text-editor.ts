import {
  getMarkdownImageMatch,
  getMediaBlockDirection,
  replaceSourceRange
} from '../markdown/markdown-editing';
import {
  formatMarkdownTableCellText,
  insertMarkdownTableColumn,
  insertMarkdownTableRow,
  updateMarkdownTableCell
} from '../markdown/markdown-table';
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

type TableCoordinates = {
  columnIndex: number;
  rowIndex: number;
};

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
  ): { body: string; changed: boolean } => {
    const body = getBody();
    const nextText = normalizePreviewEditedText(element.innerText);
    const table = element.closest<HTMLElement>('.preview-table-scroll[data-table-index]');
    const tableCoordinates = getTableCellCoordinates(element);
    const tableIndex = getTableIndex(table);
    const updatedBody = tableCoordinates && tableIndex !== null
      ? updateMarkdownTableCell(body, tableIndex, tableCoordinates.rowIndex, tableCoordinates.columnIndex, nextText)
      : updatePreviewMarkdownBlock(body, element, nextText, {
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
      changed: updatedBody !== body
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

  const getActiveTableCell = (table: HTMLElement) => {
    return activeTableCell?.closest('.preview-table-scroll') === table ? activeTableCell : null;
  };

  const getActiveTableCoordinates = (table: HTMLElement) => {
    const activeCell = getActiveTableCell(table);
    const activeCellCoordinates = activeCell ? getTableCellCoordinates(activeCell) : null;
    if (activeCellCoordinates) return activeCellCoordinates;

    const rowIndex = parseTableActionIndex(table.dataset.activeRow);
    const columnIndex = parseTableActionIndex(table.dataset.activeColumn);
    if (rowIndex === null && columnIndex === null) return null;

    return {
      columnIndex,
      rowIndex
    };
  };

  const updatePreviewTable = (table: HTMLElement, action: 'column' | 'row') => {
    const tableIndex = getTableIndex(table);
    if (tableIndex === null) return;

    recordHistory();

    const cell = getActiveTableCell(table);
    const coordinates = getActiveTableCoordinates(table);
    let body = getBody();
    if (cell?.dataset.editing === 'true') {
      const commit = commitPreviewMarkdownText(cell, { syncAfter: false });
      body = commit.body;
    }

    const updatedBody = action === 'row'
      ? insertMarkdownTableRow(body, tableIndex, coordinates?.rowIndex ?? null)
      : insertMarkdownTableColumn(body, tableIndex, coordinates?.columnIndex ?? null);

    if (updatedBody === body) return;

    setFieldValue('body', updatedBody);
    sync();
    scheduleMetadata();
  };

  preview.ownerDocument.addEventListener('pointerdown', (event) => {
    if (!activeTableCell || activeTableCell.dataset.editing !== 'true') return;

    const target = event.target;
    const targetElement = target instanceof Element ? target : null;
    if (
      (target instanceof Node && activeTableCell.contains(target))
      || targetElement?.closest('.preview-table-controls')
    ) {
      return;
    }

    commitPreviewMarkdownText(activeTableCell);
  }, true);

  const attachPreviewTableEditing = () => {
    for (const table of preview.querySelectorAll<HTMLElement>('.preview-table-scroll[data-table-index]')) {
      if (table.closest('[data-media-copy]')) continue;

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
      wireTableActionButton(rowButton, () => updatePreviewTable(table, 'row'));

      columnButton.type = 'button';
      columnButton.className = 'preview-table-control';
      columnButton.textContent = 'Add column';
      wireTableActionButton(columnButton, () => updatePreviewTable(table, 'column'));

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
        element.addEventListener('keydown', (event: KeyboardEvent) => {
          if (event.key === 'Tab' && element.dataset.editing === 'true') {
            commitPreviewMarkdownText(element);
          }
        });
      }
      const commitElement = () => {
        updatePreviewMarkdownText(element);
      };
      element.addEventListener('blur', commitElement);
      element.addEventListener('focusout', commitElement);
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
    return formatMarkdownTableCellText(text);
  }
  return text.split('\n').filter(Boolean).join('\n\n');
}

export function updatePreviewMarkdownBlock(
  markdown: string,
  element: HTMLElement | { dataset: { listMarker?: string; sourceEnd?: string; sourceStart?: string }; tagName: string },
  text: string,
  options?: { listMarker?: string }
): string {
  const sourceStart = Number(element.dataset.sourceStart);
  const sourceEnd = Number(element.dataset.sourceEnd);
  if (!Number.isInteger(sourceStart) || !Number.isInteger(sourceEnd)) return markdown;

  const replacement = formatPreviewMarkdownBlock(element.tagName, text, options);
  if (markdown.slice(sourceStart, sourceEnd) === replacement) return markdown;
  return replaceSourceRange(markdown, sourceStart, sourceEnd, () => replacement);
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

function getTableCellCoordinates(element: HTMLElement): TableCoordinates | null {
  const rowIndex = parseTableActionIndex(element.dataset.tableRow);
  const columnIndex = parseTableActionIndex(element.dataset.tableColumn);
  if (rowIndex === null || columnIndex === null) return null;

  return {
    columnIndex,
    rowIndex
  };
}

function getTableIndex(table: HTMLElement | null): number | null {
  const parsed = Number(table?.dataset.tableIndex);
  return Number.isInteger(parsed) ? parsed : null;
}

function wireTableActionButton(button: HTMLButtonElement, action: () => void): void {
  let handledPointer = false;

  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    handledPointer = true;
    action();
  });

  button.addEventListener('pointercancel', () => {
    handledPointer = false;
  });

  button.addEventListener('click', (event) => {
    event.preventDefault();
    if (handledPointer) {
      handledPointer = false;
      return;
    }

    action();
  });
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

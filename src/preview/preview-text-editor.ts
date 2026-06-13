import {
  getMarkdownImageMatch,
  getMarkdownMediaBlockCopyRange,
  getMediaBlockDirection,
  replaceSourceRange
} from '../markdown/markdown-editing';
import { getRenderedTextFromMarkdownSource } from '../markdown/markdown-renderer';
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
  commitActiveEdit(options?: { syncAfter?: boolean }): boolean;
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

export type TableCoordinates = {
  columnIndex: number;
  rowIndex: number;
};

type EditableTextOptions = {
  singleLine?: boolean;
};

type SerializedPreviewBlock = {
  kind: 'block' | 'list';
  markdown: string;
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

  const normalizePreviewEditedMarkdown = (value: string) => {
    return normalizePreviewEditedText(value);
  };

  const beginPreviewEdit = (element: HTMLElement) => {
    if (element.dataset.editing === 'true') return;

    recordHistory();
    element.dataset.editing = 'true';
  };

  const makePreviewTextEditable = (element: HTMLElement, { singleLine = false }: EditableTextOptions = {}) => {
    element.contentEditable = 'true';
    element.spellcheck = true;
    element.dataset.previewEditable = 'true';
    element.dataset.previewSingleLine = String(singleLine);
    element.setAttribute('role', 'textbox');
    element.setAttribute('aria-label', 'Edit text');

    element.addEventListener('beforeinput', (event: InputEvent) => {
      if (event.inputType === 'insertParagraph' || event.inputType === 'insertLineBreak') {
        handlePreviewEditableLineBreak(element, event);
        return;
      }

      beginPreviewEdit(element);
    });
    element.addEventListener('paste', (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text/plain');
      if (!text) return;

      event.preventDefault();
      beginPreviewEdit(element);
      insertPlainTextAtSelection(text);
    });
  };

  const handlePreviewEditableLineBreak = (element: HTMLElement, event: Event) => {
    event.preventDefault();
    if (element.dataset.previewSingleLine === 'true') {
      element.blur();
      return;
    }

    beginPreviewEdit(element);
    insertPlainTextAtSelection('\n');
  };

  const updatePreviewFieldText = (
    element: HTMLElement,
    { syncAfter = true }: { syncAfter?: boolean } = {}
  ): boolean => {
    const fieldName = element.dataset.previewField;
    if (fieldName !== 'title' && fieldName !== 'description') return false;
    const editorFieldName = fieldName as PreviewTextFieldName;

    const nextText = normalizePreviewEditedText(element.innerText);
    let changed = false;
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
      changed = true;
    }

    delete element.dataset.editing;
    if (changed && syncAfter) {
      sync();
      scheduleMetadata();
    }

    return changed;
  };

  const updatePreviewTagsText = ({ syncAfter = true }: { syncAfter?: boolean } = {}): boolean => {
    const tagElements = Array.from(preview.querySelectorAll<HTMLElement>('[data-preview-tags] li'));
    const nextTags = tagElements
      .map((element) => normalizePreviewEditedText(element.innerText))
      .filter(Boolean)
      .join(', ');
    let changed = false;
    if (getFieldValue('tags') !== nextTags) {
      setFieldValue('tags', nextTags);
      markTagsEdited();
      changed = true;
    }

    for (const element of tagElements) {
      delete element.dataset.editing;
    }

    if (changed && syncAfter) {
      sync();
      scheduleMetadata();
    }

    return changed;
  };

  const commitPreviewMarkdownText = (
    element: HTMLElement,
    { syncAfter = true }: { syncAfter?: boolean } = {}
  ): { body: string; changed: boolean } => {
    const body = getBody();
    if (element.dataset.editing !== 'true') {
      return {
        body,
        changed: false
      };
    }

    const nextText = normalizePreviewEditedMarkdown(readPreviewEditableMarkdown(element));
    const table = element.closest<HTMLElement>('.preview-table-scroll[data-table-index]');
    const tableCoordinates = getTableCellCoordinates(element);
    const tableIndex = getTableIndex(table);
    const updatedBody = tableCoordinates && tableIndex !== null
      ? updateMarkdownTableCell(body, tableIndex, tableCoordinates.rowIndex, tableCoordinates.columnIndex, nextText)
      : updatePreviewMarkdownBlock(body, element, nextText, {
          listMarker: element.dataset.listMarker
        });
    const changed = updatedBody !== body;
    if (changed) {
      setFieldValue('body', updatedBody);
    }

    delete element.dataset.editing;
    if (changed && syncAfter) {
      sync();
      scheduleMetadata();
    }

    return {
      body: updatedBody,
      changed
    };
  };

  const updatePreviewMarkdownText = (element: HTMLElement) => {
    commitPreviewMarkdownText(element);
  };

  const commitPreviewMediaCopyText = (
    copy: HTMLElement,
    { syncAfter = true }: { syncAfter?: boolean } = {}
  ): boolean => {
    if (copy.dataset.editing !== 'true') return false;

    const body = getBody();
    const updatedBody = updateMarkdownMediaBlockText(
      body,
      Number(copy.dataset.mediaIndex),
      normalizePreviewEditedMarkdown(readPreviewMediaCopyMarkdown(copy))
    );
    const changed = updatedBody !== body;
    if (changed) {
      setFieldValue('body', updatedBody);
    }

    delete copy.dataset.editing;
    if (changed && syncAfter) {
      sync();
      scheduleMetadata();
    }

    return changed;
  };

  const commitPreviewEditableText = (
    element: HTMLElement,
    { syncAfter = true }: { syncAfter?: boolean } = {}
  ): boolean => {
    if (!preview.contains(element)) return false;

    if (element.dataset.previewField) {
      return updatePreviewFieldText(element, { syncAfter });
    }

    if (element.closest('[data-preview-tags]')) {
      return updatePreviewTagsText({ syncAfter });
    }

    const mediaCopy = element.closest<HTMLElement>('[data-media-copy]');
    if (mediaCopy) {
      return commitPreviewMediaCopyText(mediaCopy, { syncAfter });
    }

    if (element.dataset.sourceStart !== undefined && element.dataset.sourceEnd !== undefined) {
      return commitPreviewMarkdownText(element, { syncAfter }).changed;
    }

    return false;
  };

  const getActivePreviewEditable = (): HTMLElement | null => {
    const activeElement = preview.ownerDocument.activeElement;
    const activeEditable = activeElement instanceof Element
      ? activeElement.closest<HTMLElement>('[data-preview-editable="true"]')
      : null;
    return activeEditable && preview.contains(activeEditable) ? activeEditable : null;
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

  preview.ownerDocument.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' || event.defaultPrevented) return;

    const element = getPreviewEditableFromEvent(preview, event);
    if (!element) return;

    handlePreviewEditableLineBreak(element, event);
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
      makePreviewTextEditable(element, { singleLine: true });
      element.addEventListener('blur', () => {
        updatePreviewFieldText(element);
      });
    }

    for (const element of preview.querySelectorAll<HTMLElement>('[data-preview-tags] li')) {
      makePreviewTextEditable(element, { singleLine: true });
      element.addEventListener('blur', () => {
        updatePreviewTagsText();
      });
    }

    for (const element of preview.querySelectorAll<HTMLElement>('.preview-body [data-source-start][data-source-end]')) {
      if (element.closest('[data-media-copy]')) continue;
      if (element.querySelector('.preview-image-frame, .preview-video-frame')) continue;

      const isTableCell = element.dataset.tableRow !== undefined && element.dataset.tableColumn !== undefined;
      makePreviewTextEditable(element, {
        singleLine: isTableCell || isHeadingElement(element)
      });
      if (isTableCell) {
        element.addEventListener('focus', () => {
          setActiveTableCell(element);
        });
        element.addEventListener('pointerdown', () => {
          setActiveTableCell(element);
        });
        element.addEventListener('keydown', (event: KeyboardEvent) => {
          if (event.key === 'Tab') {
            handleTableCellTab(element, event);
          }
        });
      }
      const commitElement = () => {
        updatePreviewMarkdownText(element);
      };
      element.addEventListener('blur', commitElement);
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
        commitPreviewMediaCopyText(copy);
      });
    }
  };

  const handleTableCellTab = (element: HTMLElement, event: KeyboardEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const table = element.closest<HTMLElement>('.preview-table-scroll[data-table-index]');
    const tableIndex = getTableIndex(table);
    const coordinates = getTableCellCoordinates(element);
    const nextCoordinates = table && coordinates
      ? getNextPreviewTableCellCoordinates(getTableCellCoordinatesList(table), coordinates, event.shiftKey ? -1 : 1)
      : null;

    if (!coordinates || tableIndex === null) {
      commitPreviewMarkdownText(element);
      return;
    }

    commitPreviewMarkdownText(element);
    focusTableCell(tableIndex, nextCoordinates || coordinates);
  };

  const focusTableCell = (tableIndex: number, coordinates: TableCoordinates) => {
    const table = Array.from(preview.querySelectorAll<HTMLElement>(`.preview-table-scroll[data-table-index="${tableIndex}"]`))
      .find((candidate) => !candidate.closest('[data-media-copy]'));
    const cell = table?.querySelector<HTMLElement>(`[data-table-row="${coordinates.rowIndex}"][data-table-column="${coordinates.columnIndex}"]`);
    if (!cell) return;

    setActiveTableCell(cell);
    cell.focus({ preventScroll: true });
    selectElementText(cell);
  };

  return {
    attach() {
      attachPreviewTextEditing();
      attachMediaTextEditing();
      attachPreviewTableEditing();
    },
    commitActiveEdit({ syncAfter = true }: { syncAfter?: boolean } = {}) {
      const element = getActivePreviewEditable();
      return element ? commitPreviewEditableText(element, { syncAfter }) : false;
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

  const source = markdown.slice(sourceStart, sourceEnd);
  if (isRenderedMarkdownTextUnchanged(source, text)) return markdown;

  const replacement = formatPreviewMarkdownBlock(element.tagName, text, options);
  if (source === replacement) return markdown;
  return replaceSourceRange(markdown, sourceStart, sourceEnd, () => replacement);
}

export function updateMarkdownMediaBlockText(markdown: string, mediaIndex: number, text: string): string {
  if (!Number.isInteger(mediaIndex)) return markdown;

  const copyRange = getMarkdownMediaBlockCopyRange(markdown, mediaIndex);
  if (copyRange && markdown.slice(copyRange.start, copyRange.end) === text) return markdown;

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

export function readPreviewEditableMarkdown(element: HTMLElement): string {
  return normalizeSerializedPreviewMarkdown(serializePreviewInlineChildren(element));
}

export function readPreviewMediaCopyMarkdown(element: HTMLElement): string {
  const blocks = serializePreviewBlockChildren(element);
  if (!blocks.length) return readPreviewEditableMarkdown(element);

  let markdown = '';
  let previousKind: SerializedPreviewBlock['kind'] | null = null;
  for (const block of blocks) {
    if (!block.markdown) continue;
    if (markdown) {
      markdown += previousKind === 'list' && block.kind === 'list' ? '\n' : '\n\n';
    }
    markdown += block.markdown;
    previousKind = block.kind;
  }

  return markdown;
}

function serializePreviewBlockChildren(element: Node): SerializedPreviewBlock[] {
  const blocks: SerializedPreviewBlock[] = [];
  let pendingInline = '';

  for (const child of Array.from(element.childNodes)) {
    const childBlocks = serializePreviewBlockNode(child);
    if (childBlocks) {
      flushPendingInline();
      blocks.push(...childBlocks);
      continue;
    }

    pendingInline += serializePreviewInlineMarkdown(child);
  }

  flushPendingInline();
  return blocks;

  function flushPendingInline(): void {
    const markdown = formatPreviewMarkdownBlock('p', normalizeSerializedPreviewMarkdown(pendingInline));
    if (markdown) {
      blocks.push({
        kind: 'block',
        markdown
      });
    }
    pendingInline = '';
  }
}

function serializePreviewBlockNode(node: Node): SerializedPreviewBlock[] | null {
  if (!isPreviewElementNode(node)) return null;

  const tagName = node.tagName.toLowerCase();
  if (tagName === 'br') {
    return null;
  }

  if (tagName === 'ul' || tagName === 'ol') {
    return Array.from(node.children)
      .filter((child) => child.tagName.toLowerCase() === 'li')
      .map((child, index) => serializePreviewListItem(child as HTMLElement, tagName, index))
      .filter((block): block is SerializedPreviewBlock => block !== null);
  }

  if (tagName === 'li') {
    const block = serializePreviewListItem(node, 'ul', 0);
    return block ? [block] : [];
  }

  if (tagName === 'h1' || tagName === 'h2' || tagName === 'h3' || tagName === 'blockquote') {
    const markdown = formatPreviewMarkdownBlock(tagName, readPreviewEditableMarkdown(node));
    return markdown ? [{ kind: 'block', markdown }] : [];
  }

  if (tagName === 'p' || tagName === 'div') {
    const nestedBlocks = serializePreviewBlockChildren(node);
    if (nestedBlocks.length) return nestedBlocks;

    const markdown = formatPreviewMarkdownBlock('p', readPreviewEditableMarkdown(node));
    return markdown ? [{ kind: 'block', markdown }] : [];
  }

  return null;
}

function serializePreviewListItem(
  element: HTMLElement,
  listTagName: 'ol' | 'ul',
  index: number
): SerializedPreviewBlock | null {
  const fallbackMarker = listTagName === 'ol' ? `${index + 1}. ` : '- ';
  const markdown = formatPreviewMarkdownBlock('li', readPreviewEditableMarkdown(element), {
    listMarker: element.dataset.listMarker || fallbackMarker
  });
  return markdown ? { kind: 'list', markdown } : null;
}

function serializePreviewInlineChildren(node: Node): string {
  return Array.from(node.childNodes).map(serializePreviewInlineMarkdown).join('');
}

function serializePreviewInlineMarkdown(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }
  if (!isPreviewElementNode(node)) return '';

  const tagName = node.tagName.toLowerCase();
  if (tagName === 'br') return '\n';
  if (tagName === 'button' || tagName === 'input' || tagName === 'script' || tagName === 'style') return '';

  const text = serializePreviewInlineChildren(node);
  if (tagName === 'strong' || tagName === 'b') return wrapPreviewInlineMarkdown(text, '**');
  if (tagName === 'em' || tagName === 'i') return wrapPreviewInlineMarkdown(text, '*');
  if (tagName === 's' || tagName === 'del' || tagName === 'strike') return wrapPreviewInlineMarkdown(text, '~~');
  if (tagName === 'code') return text ? `\`${text.replace(/`/g, '\\`')}\`` : '';
  if (tagName === 'a') {
    const href = node.getAttribute('href');
    return href && text ? `[${text}](${href})` : text;
  }
  if (isPreviewBlockBoundaryTag(tagName)) {
    return text ? `\n${text}\n` : '';
  }

  return text;
}

function wrapPreviewInlineMarkdown(text: string, wrapper: string): string {
  return text ? `${wrapper}${text}${wrapper}` : '';
}

function normalizeSerializedPreviewMarkdown(value: string): string {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function isRenderedMarkdownTextUnchanged(source: string, text: string): boolean {
  return normalizeSerializedPreviewMarkdown(getRenderedTextFromMarkdownSource(source)) === text.trim();
}

function isHeadingElement(element: HTMLElement): boolean {
  return /^h[1-3]$/i.test(element.tagName);
}

function isPreviewBlockBoundaryTag(tagName: string): boolean {
  return tagName === 'blockquote'
    || tagName === 'div'
    || tagName === 'h1'
    || tagName === 'h2'
    || tagName === 'h3'
    || tagName === 'li'
    || tagName === 'ol'
    || tagName === 'p'
    || tagName === 'ul';
}

function isPreviewElementNode(node: Node): node is HTMLElement {
  return node.nodeType === Node.ELEMENT_NODE && node instanceof HTMLElement;
}

function getPreviewEditableFromEvent(preview: HTMLElement, event: Event): HTMLElement | null {
  const target = event.target instanceof Element
    ? event.target.closest<HTMLElement>('[data-preview-editable="true"]')
    : null;
  if (target && preview.contains(target)) return target;

  const selection = preview.ownerDocument.defaultView?.getSelection();
  const anchorElement = getNodeElement(selection?.anchorNode || null);
  const selectedEditable = anchorElement?.closest<HTMLElement>('[data-preview-editable="true"]') || null;
  return selectedEditable && preview.contains(selectedEditable) ? selectedEditable : null;
}

function getNodeElement(node: Node | null): Element | null {
  if (!node) return null;
  return node instanceof Element ? node : node.parentElement;
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

function getTableCellCoordinatesList(table: HTMLElement): TableCoordinates[] {
  return Array.from(table.querySelectorAll<HTMLElement>('[data-table-row][data-table-column]'))
    .map(getTableCellCoordinates)
    .filter((coordinates): coordinates is TableCoordinates => coordinates !== null)
    .sort((a, b) => a.rowIndex - b.rowIndex || a.columnIndex - b.columnIndex);
}

export function getNextPreviewTableCellCoordinates(
  cells: TableCoordinates[],
  current: TableCoordinates,
  direction: -1 | 1
): TableCoordinates | null {
  const currentIndex = cells.findIndex((cell) => (
    cell.rowIndex === current.rowIndex
    && cell.columnIndex === current.columnIndex
  ));
  if (currentIndex < 0) return null;

  return cells[currentIndex + direction] || null;
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

  const range = selection.getRangeAt(0);
  const ownerDocument = range.commonAncestorContainer.ownerDocument || document;
  const fragment = ownerDocument.createDocumentFragment();
  const lines = text.split('\n');
  let caretNode: Node | null = null;

  lines.forEach((line, index) => {
    if (index > 0) {
      const lineBreak = ownerDocument.createElement('br');
      fragment.append(lineBreak);
      caretNode = lineBreak;
    }
    if (line) {
      const textNode = ownerDocument.createTextNode(line);
      fragment.append(textNode);
      caretNode = textNode;
    }
  });
  if (text.endsWith('\n')) {
    fragment.append(ownerDocument.createElement('br'));
  }

  selection.deleteFromDocument();
  range.insertNode(fragment);
  if (caretNode) {
    range.setStartAfter(caretNode);
  }
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

function selectElementText(element: HTMLElement): void {
  const selection = element.ownerDocument.defaultView?.getSelection();
  if (!selection) return;

  const range = element.ownerDocument.createRange();
  range.selectNodeContents(element);
  selection.removeAllRanges();
  selection.addRange(range);
}

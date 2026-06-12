import {
  defaultImageCropRatio,
  parseImageAttributes,
  clampImageWidth
} from './image-attributes';
import {
  escapeAttribute,
  escapeHtml,
  unescapeHtml
} from './html';
import {
  getMarkdownLineStarts,
  type MarkdownTable,
  type MarkdownTableAlignment,
  type MarkdownTableCell,
  parseMarkdownTableAt
} from './markdown-table';

export interface MarkdownImageState {
  nextIndex: number;
}

export interface RenderMarkdownOptions {
  imageState?: MarkdownImageState;
  resolveAssetUrl?: (path: string) => string;
  sourceMap?: boolean;
}

type ListType = 'ol' | 'ul';

export function renderMarkdown(markdown: string, options: RenderMarkdownOptions = {}): string {
  const sourceMap = options.sourceMap ?? true;
  const imageState = options.imageState ?? { nextIndex: 0 };
  const lines = String(markdown || '').split('\n');
  const lineStarts = getLineStarts(markdown);
  const html: string[] = [];
  let listItems: string[] = [];
  let listType: ListType | null = null;
  let inCode = false;
  let codeLines: string[] = [];
  let mediaBlockIndex = 0;
  let tableIndex = 0;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const lineStart = lineStarts[index] || 0;
    const lineEnd = lineStart + line.length;
    if (line.startsWith('```')) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
        codeLines = [];
        inCode = false;
      } else {
        flushList();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      codeLines.push(line);
      continue;
    }

    const mediaDirection = getMediaBlockDirection(line.trim());
    if (mediaDirection) {
      const blockLines: string[] = [];
      index += 1;
      while (index < lines.length && lines[index].trim() !== ':::') {
        blockLines.push(lines[index]);
        index += 1;
      }
      flushList();
      html.push(renderMediaBlock(blockLines, mediaBlockIndex, mediaDirection, {
        ...options,
        imageState
      }));
      mediaBlockIndex += 1;
      continue;
    }

    if (!line.trim()) {
      flushList();
      continue;
    }

    const table = parseMarkdownTableAt(lines, lineStarts, index, tableIndex);
    if (table) {
      flushList();
      html.push(renderTable(table, {
        ...options,
        imageState
      }));
      tableIndex += 1;
      index = table.endIndex;
      continue;
    }

    if (isHorizontalRule(line.trim())) {
      flushList();
      html.push('<hr>');
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      html.push(`<h${heading[1].length}${getSourceAttributes(sourceMap, lineStart, lineEnd)}>${renderInline(heading[2], {
        ...options,
        imageState
      })}</h${heading[1].length}>`);
      continue;
    }

    const taskListItem = /^(-\s+\[([ xX])\]\s+)(.+)$/.exec(line);
    if (taskListItem) {
      const checked = taskListItem[2].toLowerCase() === 'x';
      addListItem('ul', [
        `<li${getSourceAttributes(sourceMap, lineStart, lineEnd)} data-list-marker="${escapeAttribute(taskListItem[1])}" class="task-list-item">`,
        `<input type="checkbox" ${checked ? 'checked ' : ''}disabled aria-label="${checked ? 'Completed task' : 'Open task'}">`,
        `<span>${renderInline(taskListItem[3], {
          ...options,
          imageState
        })}</span>`,
        '</li>'
      ].join(''));
      continue;
    }

    const orderedListItem = /^(\d+[.)]\s+)(.+)$/.exec(line);
    if (orderedListItem) {
      addListItem('ol', `<li${getSourceAttributes(sourceMap, lineStart, lineEnd)} data-list-marker="${escapeAttribute(orderedListItem[1])}">${renderInline(orderedListItem[2], {
        ...options,
        imageState
      })}</li>`);
      continue;
    }

    const unorderedListItem = /^(-\s+)(.+)$/.exec(line);
    if (unorderedListItem) {
      addListItem('ul', `<li${getSourceAttributes(sourceMap, lineStart, lineEnd)} data-list-marker="${escapeAttribute(unorderedListItem[1])}">${renderInline(unorderedListItem[2], {
        ...options,
        imageState
      })}</li>`);
      continue;
    }

    if (line.startsWith('> ')) {
      flushList();
      html.push(`<blockquote${getSourceAttributes(sourceMap, lineStart, lineEnd)}>${renderInline(line.slice(2), {
        ...options,
        imageState
      })}</blockquote>`);
      continue;
    }

    flushList();
    html.push(`<p${getSourceAttributes(sourceMap, lineStart, lineEnd)}>${renderInline(line, {
      ...options,
      imageState
    })}</p>`);
  }

  if (inCode) {
    html.push(`<pre><code>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
  }
  flushList();
  return html.join('\n') || '<p>Start writing to see the preview.</p>';

  function addListItem(type: ListType, item: string): void {
    if (listType && listType !== type) {
      flushList();
    }
    listType = type;
    listItems.push(item);
  }

  function flushList(): void {
    if (!listItems.length) return;
    const type = listType || 'ul';
    html.push(`<${type}>${listItems.join('')}</${type}>`);
    listItems = [];
    listType = null;
  }
}

export function findRenderedSelectionInSource(
  source: string,
  selectedText: string,
  renderedStart: number,
  renderedEnd: number
): { end: number; start: number } | null {
  const mapped = createRenderedTextSourceMap(source);
  const expectedText = mapped.text.slice(renderedStart, renderedEnd);
  const textIndex = expectedText === selectedText
    ? renderedStart
    : mapped.text.indexOf(selectedText);
  if (textIndex < 0) return null;

  const start = mapped.sourceIndexes[textIndex];
  const lastIndex = mapped.sourceIndexes[textIndex + selectedText.length - 1];
  if (!Number.isInteger(start) || !Number.isInteger(lastIndex)) return null;

  return {
    end: lastIndex + 1,
    start
  };
}

export function getLineStarts(markdown: string): number[] {
  return getMarkdownLineStarts(markdown);
}

function renderMediaBlock(
  lines: string[],
  index: number,
  direction: 'left' | 'right',
  options: RenderMarkdownOptions
): string {
  const imageIndex = lines.findIndex((line) => getMarkdownImageMatch(line.trim()));
  const imageState = options.imageState ?? { nextIndex: 0 };
  if (imageIndex < 0) {
    return renderMarkdown(lines.join('\n'), {
      ...options,
      imageState,
      sourceMap: false
    });
  }

  const imageLine = lines[imageIndex].trim();
  const sideText = lines.slice(imageIndex + 1).join('\n').trim();
  const copyText = sideText || 'Write side text here.';
  const copyHtml = sideText
    ? renderMarkdown(sideText, {
        ...options,
        imageState
      })
    : `<p>${escapeHtml(copyText)}</p>`;
  const imageHtml = `<div class="preview-media-image">${renderInline(imageLine, {
    ...options,
    imageState
  })}</div>`;
  const copy = [
    `<div class="preview-media-copy${sideText ? '' : ' is-placeholder'}" contenteditable="true" data-media-copy data-media-index="${index}" role="textbox" aria-label="Image side text">`,
    copyHtml,
    '</div>'
  ].join('');
  const content = direction === 'left' ? [copy, imageHtml] : [imageHtml, copy];

  return [
    `<section class="preview-media-block" data-media-index="${index}" data-media-direction="${direction}">`,
    ...content,
    '</section>'
  ].join('');
}

function renderInline(source: string, options: RenderMarkdownOptions): string {
  const imageState = options.imageState ?? { nextIndex: 0 };
  const resolveAssetUrl = options.resolveAssetUrl ?? ((path: string) => path);
  let html = escapeHtml(source);
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)(?:\{([^}]*)\})?/g, (_match, alt, href, attributes) => {
    const path = unescapeHtml(href);
    const resolvedHref = resolveAssetUrl(path);
    const { align, cropRatio, display, focusX, focusY, rotation, shadow, width } = parseImageAttributes(attributes);
    const percent = clampImageWidth(width);
    const cropEnabled = cropRatio > 0;
    const activeCropRatio = cropEnabled ? cropRatio : defaultImageCropRatio;
    const style = [
      `--preview-image-width: ${percent}%`,
      `--preview-image-rotation: ${rotation}deg`,
      `--preview-image-crop-ratio: ${activeCropRatio}`,
      `--preview-image-focus-x: ${focusX}%`,
      `--preview-image-focus-y: ${focusY}%`
    ].join('; ');
    const imageIndex = imageState.nextIndex;
    imageState.nextIndex += 1;
    return [
      `<span class="preview-image-frame" data-image-index="${imageIndex}" data-image-path="${escapeAttribute(path)}" data-image-width="${percent}" data-image-rotation="${rotation}" data-image-crop="${cropEnabled ? 'true' : 'false'}" data-image-crop-ratio="${activeCropRatio}" data-image-focus-x="${focusX}" data-image-focus-y="${focusY}" data-image-align="${escapeAttribute(align)}" data-image-display="${escapeAttribute(display)}" data-image-shadow="${shadow ? 'smooth' : 'none'}" style="${escapeAttribute(style)}" tabindex="0" data-tooltip="Click to select. Paste to replace, Delete to remove.">`,
      '<span class="preview-image-crop-box" data-tooltip="Click to select. Paste to replace, Delete to remove.">',
      `<img src="${escapeAttribute(resolvedHref)}" alt="${escapeAttribute(unescapeHtml(alt))}">`,
      '</span>',
      '<span class="preview-image-tools">',
      `<button type="button" data-image-align-center aria-pressed="${align === 'center' ? 'true' : 'false'}" data-tooltip="${align === 'center' ? 'Stop centering image' : 'Center image'}">Center</button>`,
      '<button type="button" data-image-side-text="right" data-tooltip="Add text to the right">Text right</button>',
      '<button type="button" data-image-side-text="left" data-tooltip="Add text to the left">Text left</button>',
      `<button type="button" data-image-crop-toggle aria-pressed="${cropEnabled ? 'true' : 'false'}" data-tooltip="${cropEnabled ? 'Turn off crop' : 'Crop image'}">Crop</button>`,
      `<button type="button" data-image-display-inline aria-pressed="${display === 'inline' ? 'true' : 'false'}" data-tooltip="${display === 'inline' ? 'Show as block image' : 'Show inline'}">Inline</button>`,
      `<button type="button" data-image-shadow-toggle aria-pressed="${shadow ? 'true' : 'false'}" data-tooltip="${shadow ? 'Remove image shadow' : 'Add image shadow'}">Shadow</button>`,
      '</span>',
      '<span class="preview-image-rotate" aria-hidden="true" data-tooltip="Drag to tilt image"><svg viewBox="0 0 28 24" focusable="false"><path d="M4.6 13.6C6.9 8.4 21.1 8.4 23.4 13.6M4.6 13.6l.3-4.45M4.6 13.6l4.55-.35M23.4 13.6l-.3-4.45M23.4 13.6l-4.55-.35"></path></svg></span>',
      '<span class="preview-image-crop-resize" aria-hidden="true" data-tooltip="Drag to change crop height"></span>',
      '<span class="preview-image-resize" aria-hidden="true" data-tooltip="Drag to resize image"></span>',
      '</span>'
    ].join('');
  });
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
    return `<a href="${escapeAttribute(unescapeHtml(href))}">${label}</a>`;
  });
  html = html.replace(/~~([^~]+)~~/g, '<s>$1</s>');
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  return html;
}

function createRenderedTextSourceMap(source: string): { sourceIndexes: number[]; text: string } {
  let text = '';
  const sourceIndexes: number[] = [];
  let index = getBlockContentStart(source);

  while (index < source.length) {
    if (source.startsWith('![', index)) {
      const imageEnd = getMarkdownInlineEnd(source, index);
      if (imageEnd > index) {
        index = imageEnd;
        continue;
      }
    }

    if (source[index] === '[') {
      const link = getMarkdownLinkRange(source, index);
      if (link) {
        for (let cursor = link.labelStart; cursor < link.labelEnd; cursor += 1) {
          text += source[cursor];
          sourceIndexes.push(cursor);
        }
        index = link.end;
        continue;
      }
    }

    if (source.startsWith('**', index)) {
      index += 2;
      continue;
    }

    if (source.startsWith('~~', index)) {
      index += 2;
      continue;
    }

    if (source[index] === '*' || source[index] === '`') {
      index += 1;
      continue;
    }

    text += source[index];
    sourceIndexes.push(index);
    index += 1;
  }

  return {
    sourceIndexes,
    text
  };
}

function getBlockContentStart(source: string): number {
  const heading = /^(#{1,3})\s+/.exec(source);
  if (heading) return heading[0].length;
  const taskListItem = /^-\s+\[[ xX]\]\s+/.exec(source);
  if (taskListItem) return taskListItem[0].length;
  const orderedListItem = /^\d+[.)]\s+/.exec(source);
  if (orderedListItem) return orderedListItem[0].length;
  if (source.startsWith('- ') || source.startsWith('> ')) return 2;
  return 0;
}

function getMarkdownInlineEnd(source: string, start: number): number {
  const closeBracket = source.indexOf(']', start + 2);
  if (closeBracket < 0 || source[closeBracket + 1] !== '(') return -1;

  const closeParen = source.indexOf(')', closeBracket + 2);
  return closeParen < 0 ? -1 : closeParen + 1;
}

function getMarkdownLinkRange(source: string, start: number): { end: number; labelEnd: number; labelStart: number } | null {
  const closeBracket = source.indexOf(']', start + 1);
  if (closeBracket < 0 || source[closeBracket + 1] !== '(') return null;

  const closeParen = source.indexOf(')', closeBracket + 2);
  if (closeParen < 0) return null;

  return {
    end: closeParen + 1,
    labelEnd: closeBracket,
    labelStart: start + 1
  };
}

function getSourceAttributes(enabled: boolean, start: number, end: number): string {
  return enabled ? ` data-source-start="${start}" data-source-end="${end}"` : '';
}

function renderTable(table: MarkdownTable, options: RenderMarkdownOptions): string {
  const sourceMap = options.sourceMap ?? true;
  const headerHtml = table.header
    .map((cell, cellIndex) => `<th${getTableCellAttributes(table.alignments[cellIndex], cell, sourceMap, 0, cellIndex)}>${renderInline(cell.text, options)}</th>`)
    .join('');
  const bodyHtml = table.rows
    .map((row, rowIndex) => `<tr>${row.map((cell, cellIndex) => `<td${getTableCellAttributes(table.alignments[cellIndex], cell, sourceMap, rowIndex + 1, cellIndex)}>${renderInline(cell.text, options)}</td>`).join('')}</tr>`)
    .join('');
  const tableAttributes = sourceMap
    ? ` data-table-index="${table.index}" data-table-start="${table.start}" data-table-end="${table.end}"`
    : '';

  return [
    `<div class="preview-table-scroll"${tableAttributes}>`,
    '<table>',
    `<thead><tr>${headerHtml}</tr></thead>`,
    bodyHtml ? `<tbody>${bodyHtml}</tbody>` : '',
    '</table>',
    '</div>'
  ].join('');
}

function getTableCellAttributes(
  alignment: MarkdownTableAlignment,
  cell: MarkdownTableCell,
  sourceMap: boolean,
  rowIndex: number,
  columnIndex: number
): string {
  return [
    ` data-table-row="${rowIndex}" data-table-column="${columnIndex}"`,
    alignment ? ` data-align="${alignment}"` : '',
    getSourceAttributes(sourceMap, cell.start, cell.end)
  ].join('');
}

function isHorizontalRule(line: string): boolean {
  return /^(?:-{3,}|\*{3,}|_{3,})$/.test(line.replace(/\s+/g, ''));
}

function getMediaBlockDirection(line: string): 'left' | 'right' | null {
  if (line === ':::media-right') return 'right';
  if (line === ':::media-left') return 'left';
  return null;
}

function getMarkdownImageMatch(line: string): unknown {
  return /^!\[([^\]]*)]\(([^)]+)\)(?:\{([^}]*)\})?$/.exec(line);
}

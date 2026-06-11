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

export interface MarkdownImageState {
  nextIndex: number;
}

export interface RenderMarkdownOptions {
  imageState?: MarkdownImageState;
  resolveAssetUrl?: (path: string) => string;
  sourceMap?: boolean;
}

export function renderMarkdown(markdown: string, options: RenderMarkdownOptions = {}): string {
  const sourceMap = options.sourceMap ?? true;
  const imageState = options.imageState ?? { nextIndex: 0 };
  const lines = String(markdown || '').split('\n');
  const lineStarts = getLineStarts(markdown);
  const html: string[] = [];
  let listItems: string[] = [];
  let inCode = false;
  let codeLines: string[] = [];
  let mediaBlockIndex = 0;

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

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      html.push(`<h${heading[1].length}${getSourceAttributes(sourceMap, lineStart, lineEnd)}>${renderInline(heading[2], {
        ...options,
        imageState
      })}</h${heading[1].length}>`);
      continue;
    }

    if (line.startsWith('- ')) {
      listItems.push(`<li${getSourceAttributes(sourceMap, lineStart, lineEnd)}>${renderInline(line.slice(2), {
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

  function flushList(): void {
    if (!listItems.length) return;
    html.push(`<ul>${listItems.join('')}</ul>`);
    listItems = [];
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
  const starts: number[] = [];
  let offset = 0;
  for (const line of String(markdown || '').split('\n')) {
    starts.push(offset);
    offset += line.length + 1;
  }
  return starts;
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
        imageState,
        sourceMap: false
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
      `<span class="preview-image-frame" data-image-index="${imageIndex}" data-image-path="${escapeAttribute(path)}" data-image-width="${percent}" data-image-rotation="${rotation}" data-image-crop="${cropEnabled ? 'true' : 'false'}" data-image-crop-ratio="${activeCropRatio}" data-image-focus-x="${focusX}" data-image-focus-y="${focusY}" data-image-align="${escapeAttribute(align)}" data-image-display="${escapeAttribute(display)}" data-image-shadow="${shadow ? 'smooth' : 'none'}" style="${escapeAttribute(style)}" tabindex="0" title="Click to select, then paste an image to replace it">`,
      '<span class="preview-image-crop-box" title="Drag to reposition crop">',
      `<img src="${escapeAttribute(resolvedHref)}" alt="${escapeAttribute(unescapeHtml(alt))}">`,
      '</span>',
      '<span class="preview-image-tools">',
      '<button type="button" data-image-align-center>Center</button>',
      '<button type="button" data-image-side-text="right">Text right</button>',
      '<button type="button" data-image-side-text="left">Text left</button>',
      `<button type="button" data-image-crop-toggle aria-pressed="${cropEnabled ? 'true' : 'false'}">Crop</button>`,
      `<button type="button" data-image-display-inline aria-pressed="${display === 'inline' ? 'true' : 'false'}">Inline</button>`,
      `<button type="button" data-image-shadow-toggle aria-pressed="${shadow ? 'true' : 'false'}">Shadow</button>`,
      '</span>',
      '<span class="preview-image-rotate" aria-hidden="true" title="Drag to tilt image"><svg viewBox="0 0 28 24" focusable="false"><path d="M4.6 13.6C6.9 8.4 21.1 8.4 23.4 13.6M4.6 13.6l.3-4.45M4.6 13.6l4.55-.35M23.4 13.6l-.3-4.45M23.4 13.6l-4.55-.35"></path></svg></span>',
      '<span class="preview-image-crop-resize" aria-hidden="true" title="Drag to change crop height"></span>',
      '<span class="preview-image-resize" aria-hidden="true"></span>',
      '</span>'
    ].join('');
  });
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label, href) => {
    return `<a href="${escapeAttribute(unescapeHtml(href))}">${label}</a>`;
  });
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

function getMediaBlockDirection(line: string): 'left' | 'right' | null {
  if (line === ':::media-right') return 'right';
  if (line === ':::media-left') return 'left';
  return null;
}

function getMarkdownImageMatch(line: string): unknown {
  return /^!\[([^\]]*)]\(([^)]+)\)(?:\{([^}]*)\})?$/.exec(line);
}

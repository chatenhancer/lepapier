type MarkdownInput = HTMLInputElement | HTMLTextAreaElement;

interface RectLike {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}

interface ScrollSelectionIntoViewOptions {
  block?: 'center' | 'nearest';
  bottomOffset?: number;
  topOffset?: number;
}

export function replaceSelection(input: MarkdownInput, text: string): void {
  const { start, end } = getSelectionRange(input);
  const before = input.value.slice(0, start);
  const after = input.value.slice(end);
  const prefix = before && !before.endsWith('\n') && needsBlockPadding(text) ? '\n\n' : '';
  const suffix = after && !after.startsWith('\n') && needsBlockPadding(text) ? '\n\n' : '';
  input.value = `${before}${prefix}${text}${suffix}${after}`;
  const cursor = before.length + prefix.length + text.length;
  input.focus({ preventScroll: true });
  input.setSelectionRange(cursor, cursor);
}

export function getSelectionRange(input: MarkdownInput): { end: number; start: number } {
  return {
    end: input.selectionEnd || 0,
    start: input.selectionStart || 0
  };
}

export function scrollSelectionIntoView(
  input: MarkdownInput,
  {
    block = 'nearest',
    bottomOffset = 32,
    topOffset = 0
  }: ScrollSelectionIntoViewOptions = {}
): void {
  const rect = getSelectionRect(input);
  const viewportTop = topOffset;
  const viewportBottom = window.innerHeight - bottomOffset;

  if (rect.top >= viewportTop && rect.bottom <= viewportBottom) return;

  const targetTop = block === 'center'
    ? window.scrollY + rect.top - (viewportTop + ((viewportBottom - viewportTop) * 0.45))
    : getNearestScrollTop(rect, viewportTop, viewportBottom);

  window.scrollTo(window.scrollX, Math.max(0, Math.round(targetTop)));
}

function needsBlockPadding(text: string): boolean {
  return /^(#{1,6}\s|> |- |\d+[.)]\s|\`\`\`)/.test(text);
}

function getNearestScrollTop(rect: RectLike, viewportTop: number, viewportBottom: number): number {
  if (rect.top < viewportTop) {
    return window.scrollY + rect.top - viewportTop;
  }

  return window.scrollY + rect.bottom - viewportBottom;
}

function getSelectionRect(input: MarkdownInput): RectLike {
  if (input.tagName !== 'TEXTAREA') {
    return input.getBoundingClientRect();
  }

  return getTextareaSelectionRect(input as HTMLTextAreaElement);
}

function getTextareaSelectionRect(input: HTMLTextAreaElement): RectLike {
  const windowTarget = input.ownerDocument.defaultView || window;
  const style = windowTarget.getComputedStyle(input);
  const inputRect = input.getBoundingClientRect();
  const mirror = input.ownerDocument.createElement('div');
  const marker = input.ownerDocument.createElement('span');

  applyTextareaMirrorStyles(mirror, style, inputRect.width);
  mirror.textContent = input.value.slice(0, input.selectionStart || 0);
  marker.textContent = '\u200b';
  mirror.append(marker);
  input.ownerDocument.body.append(mirror);

  const mirrorRect = mirror.getBoundingClientRect();
  const markerRect = marker.getBoundingClientRect();
  const fontSize = Number.parseFloat(style.fontSize) || 18;
  const lineHeight = Number.parseFloat(style.lineHeight) || fontSize * 1.78;
  const top = inputRect.top + (markerRect.top - mirrorRect.top) - input.scrollTop;
  const left = inputRect.left + (markerRect.left - mirrorRect.left) - input.scrollLeft;

  mirror.remove();

  return {
    bottom: top + lineHeight,
    height: lineHeight,
    left,
    right: left + markerRect.width,
    top,
    width: markerRect.width
  };
}

function applyTextareaMirrorStyles(
  mirror: HTMLDivElement,
  style: CSSStyleDeclaration,
  width: number
): void {
  const copiedProperties = [
    'border-bottom-width',
    'border-left-width',
    'border-right-width',
    'border-top-width',
    'box-sizing',
    'font-family',
    'font-feature-settings',
    'font-kerning',
    'font-size',
    'font-stretch',
    'font-style',
    'font-variant',
    'font-variant-caps',
    'font-weight',
    'letter-spacing',
    'line-height',
    'padding-bottom',
    'padding-left',
    'padding-right',
    'padding-top',
    'tab-size',
    'text-align',
    'text-indent',
    'text-rendering',
    'text-transform',
    'word-spacing'
  ];

  for (const property of copiedProperties) {
    mirror.style.setProperty(property, style.getPropertyValue(property));
  }

  mirror.style.height = 'auto';
  mirror.style.left = '-9999px';
  mirror.style.minHeight = '0';
  mirror.style.overflow = 'hidden';
  mirror.style.overflowWrap = 'break-word';
  mirror.style.pointerEvents = 'none';
  mirror.style.position = 'absolute';
  mirror.style.top = '0';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.width = `${width}px`;
  mirror.style.wordBreak = 'normal';
  mirror.style.wordWrap = 'break-word';
}

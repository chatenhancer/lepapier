import { getElement, nodeContains } from '../dom/elements';
import { findRenderedSelectionInSource } from '../markdown/markdown-renderer';
import { getMarkdownMediaBlockCopyRange } from '../markdown/markdown-editing';

export interface PreviewSelectionSourceRange {
  absoluteEnd: number;
  absoluteStart: number;
  body: string;
  selection: Selection;
  sourceEnd: number;
  sourceStart: number;
}

export interface GetPreviewSelectionSourceRangeOptions {
  body: string;
  preview: HTMLElement;
  selection?: Selection | null;
}

export function getPreviewSelectionSourceRange({
  body,
  preview,
  selection = window.getSelection()
}: GetPreviewSelectionSourceRangeOptions): PreviewSelectionSourceRange | null {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const range = selection.getRangeAt(0);
  const previewBody = preview.querySelector('.preview-body');
  if (!previewBody || !nodeContains(previewBody, range.startContainer) || !nodeContains(previewBody, range.endContainer)) {
    return null;
  }

  const mediaCopy = getMediaCopyElement(range.startContainer);
  const endMediaCopy = getMediaCopyElement(range.endContainer);
  if (mediaCopy || endMediaCopy) {
    if (!mediaCopy || mediaCopy !== endMediaCopy) return null;
    return getMediaCopySelectionSourceRange({
      body,
      mediaCopy,
      range,
      selectedText: selection.toString(),
      selection
    });
  }

  const sourceElement = getSourceElement(range.startContainer);
  if (!sourceElement || sourceElement !== getSourceElement(range.endContainer)) {
    return null;
  }

  const selectedText = selection.toString();
  if (!selectedText.trim()) return null;

  const sourceStart = Number(sourceElement.dataset.sourceStart);
  const sourceEnd = Number(sourceElement.dataset.sourceEnd);
  const renderedStart = getRenderedOffset(sourceElement, range.startContainer, range.startOffset);
  const renderedEnd = getRenderedOffset(sourceElement, range.endContainer, range.endOffset);
  const sourceRange = findRenderedSelectionInSource(body.slice(sourceStart, sourceEnd), selectedText, renderedStart, renderedEnd);
  if (!sourceRange) return null;

  return {
    absoluteEnd: sourceStart + sourceRange.end,
    absoluteStart: sourceStart + sourceRange.start,
    body,
    selection,
    sourceEnd,
    sourceStart
  };
}

function getSourceElement(node: Node): HTMLElement | null {
  return getElement(node)?.closest('[data-source-start][data-source-end]') || null;
}

function getMediaCopyElement(node: Node): HTMLElement | null {
  return getElement(node)?.closest('[data-media-copy]') || null;
}

function getMediaCopySelectionSourceRange({
  body,
  mediaCopy,
  range,
  selectedText,
  selection
}: {
  body: string;
  mediaCopy: HTMLElement;
  range: Range;
  selectedText: string;
  selection: Selection;
}): PreviewSelectionSourceRange | null {
  if (!selectedText.trim()) return null;

  const copyRange = getMarkdownMediaBlockCopyRange(body, Number(mediaCopy.dataset.mediaIndex));
  if (!copyRange) return null;

  const sourceElement = getSourceElement(range.startContainer);
  if (
    !sourceElement
    || sourceElement !== getSourceElement(range.endContainer)
    || !mediaCopy.contains(sourceElement)
  ) {
    return getMediaCopyRootSelectionSourceRange({
      body,
      copyRange,
      mediaCopy,
      range,
      selectedText,
      selection
    });
  }

  const relativeSourceStart = Number(sourceElement.dataset.sourceStart);
  const relativeSourceEnd = Number(sourceElement.dataset.sourceEnd);
  if (!Number.isInteger(relativeSourceStart) || !Number.isInteger(relativeSourceEnd)) return null;

  const sourceStart = copyRange.start + relativeSourceStart;
  const sourceEnd = copyRange.start + relativeSourceEnd;
  const renderedStart = getRenderedOffset(sourceElement, range.startContainer, range.startOffset);
  const renderedEnd = getRenderedOffset(sourceElement, range.endContainer, range.endOffset);
  const sourceRange = findRenderedSelectionInSource(body.slice(sourceStart, sourceEnd), selectedText, renderedStart, renderedEnd);
  if (!sourceRange) return null;

  return {
    absoluteEnd: sourceStart + sourceRange.end,
    absoluteStart: sourceStart + sourceRange.start,
    body,
    selection,
    sourceEnd,
    sourceStart
  };
}

function getMediaCopyRootSelectionSourceRange({
  body,
  copyRange,
  mediaCopy,
  range,
  selectedText,
  selection
}: {
  body: string;
  copyRange: { end: number; start: number };
  mediaCopy: HTMLElement;
  range: Range;
  selectedText: string;
  selection: Selection;
}): PreviewSelectionSourceRange | null {
  if (!mediaCopy.contains(range.startContainer) || !mediaCopy.contains(range.endContainer)) return null;

  const renderedStart = getRenderedOffset(mediaCopy, range.startContainer, range.startOffset);
  const renderedEnd = getRenderedOffset(mediaCopy, range.endContainer, range.endOffset);
  const sourceRange = findRenderedSelectionInSource(body.slice(copyRange.start, copyRange.end), selectedText, renderedStart, renderedEnd);
  if (!sourceRange) return null;

  return {
    absoluteEnd: copyRange.start + sourceRange.end,
    absoluteStart: copyRange.start + sourceRange.start,
    body,
    selection,
    sourceEnd: copyRange.end,
    sourceStart: copyRange.start
  };
}

function getRenderedOffset(root: Node, container: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(root, 0);
  range.setEnd(container, offset);
  return range.toString().length;
}

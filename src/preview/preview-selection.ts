import { getElement, nodeContains } from '../dom/elements';
import { findRenderedSelectionInSource } from '../markdown/markdown-renderer';

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

  if (getElement(range.startContainer)?.closest('.preview-media-copy') || getElement(range.endContainer)?.closest('.preview-media-copy')) {
    return null;
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

function getRenderedOffset(root: Node, container: Node, offset: number): number {
  const range = document.createRange();
  range.setStart(root, 0);
  range.setEnd(container, offset);
  return range.toString().length;
}

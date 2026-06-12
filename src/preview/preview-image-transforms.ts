import {
  clampImageCropRatio,
  clampImageFocus,
  clampImageRotation,
  defaultImageCropRatio,
  formatImageAttributes,
  parseImageAttributes
} from '../markdown/image-attributes';
import {
  getMarkdownImageMatch,
  getMarkdownImageOccurrences,
  getMediaBlockDirection,
  lineReferencesImagePath
} from '../markdown/markdown-editing';
import { escapeRegExp } from '../shared/text';

type ImageAlign = 'center' | 'left' | 'right';
type ImageDisplay = 'block' | 'inline';
type ImageAttributes = ReturnType<typeof parseImageAttributes>;

export function setMarkdownImageWidth(markdown: string, path: string, width: number): string {
  return updateMarkdownImageAttributes(markdown, path, (attributes) => ({
    ...attributes,
    width
  }));
}

export function setMarkdownImageAlignment(markdown: string, path: string, align: ImageAlign): string {
  return updateMarkdownImageAttributes(markdown, path, (attributes) => ({
    ...attributes,
    align
  }));
}

export function removeMarkdownImage(markdown: string, path: string, imageIndex: number): string {
  const occurrence = getMarkdownImageOccurrences(markdown)
    .find((item) => item.index === imageIndex && item.path === path);
  if (!occurrence) return markdown;

  const lines = markdown.split('\n');
  const lineIndex = getLineIndexAtOffset(lines, occurrence.start);
  const mediaBlock = getMediaBlockRange(lines, lineIndex);
  if (mediaBlock) {
    const selectedLine = lines[lineIndex]?.trim() || '';
    const selectedImage = getMarkdownImageMatch(selectedLine);
    if (selectedImage?.path === path) {
      return removeMediaBlockImage(lines, mediaBlock, lineIndex);
    }
  }

  return removeImageOccurrence(markdown, occurrence.start, occurrence.end, lines, lineIndex);
}

export function setMarkdownImageShadow(markdown: string, path: string, shadow: boolean): string {
  return updateMarkdownImageAttributes(markdown, path, (attributes) => ({
    ...attributes,
    shadow
  }));
}

export function setMarkdownImageRotation(markdown: string, path: string, rotation: unknown): string {
  return updateMarkdownImageAttributes(markdown, path, (attributes) => ({
    ...attributes,
    rotation: clampImageRotation(rotation)
  }));
}

export function setMarkdownImageCrop(markdown: string, path: string, cropRatio: unknown): string {
  return updateMarkdownImageAttributes(markdown, path, (attributes) => {
    const nextAttributes = {
      ...attributes,
      cropRatio: clampImageCropRatio(cropRatio)
    };
    if (nextAttributes.cropRatio <= 0) {
      nextAttributes.focusX = 50;
      nextAttributes.focusY = 50;
    }
    return nextAttributes;
  });
}

export function setMarkdownImageCropFocus(markdown: string, path: string, focusX: unknown, focusY: unknown): string {
  return updateMarkdownImageAttributes(markdown, path, (attributes) => {
    const nextAttributes = {
      ...attributes,
      focusX: clampImageFocus(focusX),
      focusY: clampImageFocus(focusY)
    };
    if (nextAttributes.cropRatio <= 0) {
      nextAttributes.cropRatio = defaultImageCropRatio;
    }
    return nextAttributes;
  });
}

export function setMarkdownImageDisplay(markdown: string, path: string, display: ImageDisplay): string {
  return updateMarkdownImageAttributes(markdown, path, (attributes) => {
    const nextAttributes = { ...attributes, display };
    if (display === 'inline') {
      nextAttributes.align = 'left';
      nextAttributes.cropRatio = 0;
      nextAttributes.focusX = 50;
      nextAttributes.focusY = 50;
    }
    return nextAttributes;
  });
}

export function wrapMarkdownImageWithSideText(markdown: string, path: string, direction: 'left' | 'right'): string {
  const lines = markdown.split('\n');
  let inMediaBlock = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (getMediaBlockDirection(trimmed)) {
      inMediaBlock = true;
      continue;
    }
    if (inMediaBlock && trimmed === ':::') {
      inMediaBlock = false;
      continue;
    }
    if (inMediaBlock || !lineReferencesImagePath(line, path)) continue;

    lines.splice(index, 1, `:::media-${direction}`, '', line.trim(), '', 'Write side text here.', '', ':::');
    return lines.join('\n');
  }

  return markdown;
}

function updateMarkdownImageAttributes(
  markdown: string,
  path: string,
  update: (attributes: ImageAttributes) => ImageAttributes
): string {
  const escapedPath = escapeRegExp(path);
  const pattern = new RegExp(`(!\\[[^\\]]*\\]\\(${escapedPath}\\))(?:\\{([^}]*)\\})?`);
  return markdown.replace(pattern, (_match: string, imageMarkdown: string, attributes: string | undefined) => {
    return `${imageMarkdown}${formatImageAttributes(update(parseImageAttributes(attributes)))}`;
  });
}

function removeImageOccurrence(
  markdown: string,
  start: number,
  end: number,
  lines: string[],
  lineIndex: number
): string {
  const line = lines[lineIndex] || '';
  const occurrenceText = markdown.slice(start, end);
  if (line.trim() === occurrenceText.trim()) {
    lines.splice(lineIndex, 1);
    cleanBlankLinesAround(lines, lineIndex);
    return lines.join('\n');
  }

  return `${markdown.slice(0, start)}${markdown.slice(end)}`;
}

function removeMediaBlockImage(
  lines: string[],
  mediaBlock: { endIndex: number; startIndex: number },
  imageLineIndex: number
): string {
  const blockLines = lines.slice(mediaBlock.startIndex + 1, mediaBlock.endIndex);
  const relativeImageLineIndex = imageLineIndex - mediaBlock.startIndex - 1;
  const replacementText = blockLines
    .filter((_line, index) => index !== relativeImageLineIndex)
    .join('\n')
    .trim();
  const replacementLines = replacementText ? replacementText.split('\n') : [];
  const deleteCount = mediaBlock.endIndex - mediaBlock.startIndex + (mediaBlock.endIndex < lines.length ? 1 : 0);
  lines.splice(mediaBlock.startIndex, deleteCount, ...replacementLines);
  cleanBlankLinesAround(lines, mediaBlock.startIndex);
  return lines.join('\n');
}

function getMediaBlockRange(lines: string[], lineIndex: number): { endIndex: number; startIndex: number } | null {
  for (let index = 0; index < lines.length; index += 1) {
    if (!getMediaBlockDirection(lines[index].trim())) continue;

    const startIndex = index;
    let endIndex = index + 1;
    while (endIndex < lines.length && lines[endIndex].trim() !== ':::') {
      endIndex += 1;
    }
    if (lineIndex > startIndex && lineIndex < endIndex) {
      return { endIndex, startIndex };
    }
    index = endIndex;
  }

  return null;
}

function getLineIndexAtOffset(lines: string[], offset: number): number {
  let cursor = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const lineEnd = cursor + lines[index].length;
    if (offset <= lineEnd) return index;
    cursor = lineEnd + 1;
  }

  return Math.max(0, lines.length - 1);
}

function cleanBlankLinesAround(lines: string[], index: number): void {
  if (index > 0 && index < lines.length && isBlankLine(lines[index - 1]) && isBlankLine(lines[index])) {
    lines.splice(index, 1);
  }
  while (lines.length && isBlankLine(lines[0])) {
    lines.shift();
  }
  while (lines.length && isBlankLine(lines[lines.length - 1])) {
    lines.pop();
  }
}

function isBlankLine(line: string | undefined): boolean {
  return !String(line || '').trim();
}

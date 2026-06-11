import { parseImageAttributes } from './image-attributes';
import { getLineStarts } from './markdown-renderer';

export interface MarkdownImageMatch {
  align: 'left' | 'center' | 'right';
  alt: string;
  cropRatio: number;
  display: 'block' | 'inline';
  focusX: number;
  focusY: number;
  path: string;
  rotation: number;
  shadow: boolean;
  width: number;
}

export interface MarkdownImageOccurrence {
  alt: string;
  end: number;
  index: number;
  path: string;
  rawAttributes: string;
  start: number;
}

export function toggleMarkdownWrapper(source: string, start: number, end: number, wrapper: string): string {
  const wrapperStart = start - wrapper.length;
  const hasWrapper = hasExactMarkdownWrapper(source, start, end, wrapper);

  if (hasWrapper) {
    return `${source.slice(0, wrapperStart)}${source.slice(start, end)}${source.slice(end + wrapper.length)}`;
  }

  return `${source.slice(0, start)}${wrapper}${source.slice(start, end)}${wrapper}${source.slice(end)}`;
}

export function toggleMarkdownLink(source: string, start: number, end: number): string {
  const linkStart = start - 1;
  const linkSuffixStart = end;
  if (source[linkStart] === '[' && source.slice(linkSuffixStart, linkSuffixStart + 2) === '](') {
    const linkEnd = source.indexOf(')', linkSuffixStart + 2);
    if (linkEnd > linkSuffixStart) {
      return `${source.slice(0, linkStart)}${source.slice(start, end)}${source.slice(linkEnd + 1)}`;
    }
  }

  return `${source.slice(0, start)}[${source.slice(start, end)}](https://example.com)${source.slice(end)}`;
}

export function toggleHeadingBlock(source: string, start: number, end: number): string {
  return replaceSourceRange(source, start, end, (block) => {
    const heading = /^(#{1,3})\s+(.+)$/.exec(block);
    return heading ? heading[2] : `## ${block}`;
  });
}

export function toggleLinePrefix(source: string, start: number, end: number, prefix: string): string {
  return replaceSourceRange(source, start, end, (block) => {
    return block.split('\n').map((line) => {
      if (!line.trim()) return line;
      return line.startsWith(prefix) ? line.slice(prefix.length) : `${prefix}${line}`;
    }).join('\n');
  });
}

export function replaceSourceRange(
  source: string,
  start: number,
  end: number,
  replacer: (block: string) => string
): string {
  return `${source.slice(0, start)}${replacer(source.slice(start, end))}${source.slice(end)}`;
}

export function getMarkdownImageMatch(line: string): MarkdownImageMatch | null {
  const match = /^!\[([^\]]*)]\(([^)]+)\)(?:\{([^}]*)\})?$/.exec(line);
  if (!match) return null;
  const attributes = parseImageAttributes(match[3]);
  return {
    align: attributes.align,
    alt: match[1],
    cropRatio: attributes.cropRatio,
    display: attributes.display,
    focusX: attributes.focusX,
    focusY: attributes.focusY,
    path: match[2],
    rotation: attributes.rotation,
    shadow: attributes.shadow,
    width: attributes.width
  };
}

export function getMarkdownImageOccurrences(markdown: string): MarkdownImageOccurrence[] {
  const lines = String(markdown || '').split('\n');
  const lineStarts = getLineStarts(markdown);
  const occurrences: MarkdownImageOccurrence[] = [];
  let inCode = false;

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex];
    if (line.startsWith('```')) {
      inCode = !inCode;
      continue;
    }
    if (inCode) continue;

    addImageOccurrencesFromLine(line, lineStarts[lineIndex] || 0, occurrences);
  }

  return occurrences;
}

export function getMediaBlockDirection(line: string): 'left' | 'right' | null {
  if (line === ':::media-right') return 'right';
  if (line === ':::media-left') return 'left';
  return null;
}

export function lineReferencesImagePath(line: string, path: string): boolean {
  const match = getMarkdownImageMatch(line.trim());
  return match ? match.path === path : false;
}

function addImageOccurrencesFromLine(
  line: string,
  lineStart: number,
  occurrences: MarkdownImageOccurrence[]
): void {
  const pattern = /!\[([^\]]*)]\(([^)]+)\)(?:\{([^}]*)\})?/g;
  let match = pattern.exec(line);
  while (match) {
    occurrences.push({
      alt: match[1],
      end: lineStart + match.index + match[0].length,
      index: occurrences.length,
      path: match[2],
      rawAttributes: match[3] || '',
      start: lineStart + match.index
    });
    match = pattern.exec(line);
  }
}

function hasExactMarkdownWrapper(source: string, start: number, end: number, wrapper: string): boolean {
  const wrapperStart = start - wrapper.length;
  if (wrapperStart < 0) return false;
  if (source.slice(wrapperStart, start) !== wrapper) return false;
  if (source.slice(end, end + wrapper.length) !== wrapper) return false;

  if (wrapper === '*') {
    return source[wrapperStart - 1] !== '*' && source[end + wrapper.length] !== '*';
  }

  return true;
}

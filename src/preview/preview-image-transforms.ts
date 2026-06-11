import {
  clampImageCropRatio,
  clampImageFocus,
  clampImageRotation,
  defaultImageCropRatio,
  formatImageAttributes,
  parseImageAttributes
} from '../markdown/image-attributes';
import {
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

import { formatDisplayDate, getToday } from '../shared/date';
import { parseTags } from '../shared/text';
import {
  escapeAttribute,
  escapeHtml
} from '../markdown/html';

export interface PreviewCover {
  alt: string;
  src: string;
}

export interface RenderDocumentPreviewOptions {
  body: string;
  cover?: PreviewCover | null;
  date?: string;
  description?: string;
  renderMarkdown(markdown: string): string;
  tags?: string;
  title?: string;
}

export function renderDocumentPreview({
  body,
  cover = null,
  date = getToday(),
  description = '',
  renderMarkdown,
  tags = '',
  title = ''
}: RenderDocumentPreviewOptions): string {
  const previewTitle = title || 'Untitled document';
  const previewDate = date || getToday();
  const parsedTags = parseTags(tags);
  const bodyHtml = renderMarkdown(body);
  const tagHtml = parsedTags.length
    ? `<ul class="preview-tags" data-preview-tags>${parsedTags.map((tag) => `<li>${escapeHtml(tag)}</li>`).join('')}</ul>`
    : '';
  const coverHtml = cover
    ? `<figure class="preview-cover"><img src="${escapeAttribute(cover.src)}" alt="${escapeAttribute(cover.alt)}"></figure>`
    : '';

  return [
    '<header class="preview-header">',
    `<time datetime="${escapeAttribute(previewDate)}">${escapeHtml(formatDisplayDate(previewDate))}</time>`,
    `<h1 class="preview-title" data-preview-field="title">${escapeHtml(previewTitle)}</h1>`,
    description ? `<p class="preview-description" data-preview-field="description">${escapeHtml(description)}</p>` : '',
    tagHtml,
    '</header>',
    coverHtml,
    `<div class="preview-body">${bodyHtml}</div>`
  ].join('');
}

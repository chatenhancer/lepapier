import {
  getMarkdownImageMatch,
  getMediaBlockDirection,
  replaceSourceRange
} from '../markdown/markdown-editing';
import { replaceStraightSmartPunctuation } from '../markdown/smart-punctuation';
import type { DocumentFields } from '../shared/types';
import { slugify } from '../shared/text';

type PreviewTextFieldName = Extract<keyof DocumentFields, 'description' | 'title'>;
type WritableFieldName = Extract<keyof DocumentFields, 'body' | 'description' | 'slug' | 'tags' | 'title'>;

export interface PreviewTextEditor {
  attach(): void;
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
  const normalizePreviewEditedText = (value: string) => {
    const text = String(value || '').replace(/\u00a0/g, ' ').trim();
    return isSmartPunctuationEnabled() ? replaceStraightSmartPunctuation(text) : text;
  };

  const makePreviewTextEditable = (element: HTMLElement) => {
    element.contentEditable = 'true';
    element.spellcheck = true;
    element.dataset.previewEditable = 'true';
    element.setAttribute('role', 'textbox');
    element.setAttribute('aria-label', 'Edit text');

    element.addEventListener('beforeinput', () => {
      if (element.dataset.editing === 'true') return;
      recordHistory();
      element.dataset.editing = 'true';
    });
    element.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.shiftKey) return;
      event.preventDefault();
      element.blur();
    });
    element.addEventListener('paste', (event: ClipboardEvent) => {
      const text = event.clipboardData?.getData('text/plain');
      if (!text) return;

      event.preventDefault();
      insertPlainTextAtSelection(text);
    });
  };

  const updatePreviewFieldText = (element: HTMLElement) => {
    const fieldName = element.dataset.previewField;
    if (fieldName !== 'title' && fieldName !== 'description') return;
    const editorFieldName = fieldName as PreviewTextFieldName;

    const nextText = normalizePreviewEditedText(element.innerText);
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
      sync();
      scheduleMetadata();
    }

    delete element.dataset.editing;
  };

  const updatePreviewTagsText = () => {
    const tagElements = Array.from(preview.querySelectorAll<HTMLElement>('[data-preview-tags] li'));
    const nextTags = tagElements
      .map((element) => normalizePreviewEditedText(element.innerText))
      .filter(Boolean)
      .join(', ');
    if (getFieldValue('tags') !== nextTags) {
      setFieldValue('tags', nextTags);
      markTagsEdited();
      sync();
      scheduleMetadata();
    }

    for (const element of tagElements) {
      delete element.dataset.editing;
    }
  };

  const updatePreviewMarkdownText = (element: HTMLElement) => {
    const sourceStart = Number(element.dataset.sourceStart);
    const sourceEnd = Number(element.dataset.sourceEnd);
    if (!Number.isInteger(sourceStart) || !Number.isInteger(sourceEnd)) return;

    const body = getBody();
    const nextText = normalizePreviewEditedText(element.innerText);
    const updatedBody = updatePreviewMarkdownBlock(body, sourceStart, sourceEnd, element.tagName, nextText);
    if (updatedBody !== body) {
      setFieldValue('body', updatedBody);
      sync();
      scheduleMetadata();
    }

    delete element.dataset.editing;
  };

  const attachPreviewTextEditing = () => {
    for (const element of preview.querySelectorAll<HTMLElement>('[data-preview-field]')) {
      makePreviewTextEditable(element);
      element.addEventListener('blur', () => {
        updatePreviewFieldText(element);
      });
    }

    for (const element of preview.querySelectorAll<HTMLElement>('[data-preview-tags] li')) {
      makePreviewTextEditable(element);
      element.addEventListener('blur', updatePreviewTagsText);
    }

    for (const element of preview.querySelectorAll<HTMLElement>('.preview-body [data-source-start][data-source-end]')) {
      if (element.querySelector('.preview-image-frame')) continue;

      makePreviewTextEditable(element);
      element.addEventListener('blur', () => {
        updatePreviewMarkdownText(element);
      });
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
        const updatedBody = updateMarkdownMediaBlockText(
          getBody(),
          Number(copy.dataset.mediaIndex),
          normalizePreviewEditedText(copy.innerText)
        );
        if (updatedBody === getBody()) return;

        recordHistory();
        setFieldValue('body', updatedBody);
        sync();
      });
    }
  };

  return {
    attach() {
      attachPreviewTextEditing();
      attachMediaTextEditing();
    }
  };
}

export function formatPreviewMarkdownBlock(tagName: string, text: string): string {
  if (!text) return '';

  const normalizedTagName = tagName.toLowerCase();
  if (normalizedTagName === 'h1') return `# ${text}`;
  if (normalizedTagName === 'h2') return `## ${text}`;
  if (normalizedTagName === 'h3') return `### ${text}`;
  if (normalizedTagName === 'li') {
    return text.split('\n').filter(Boolean).map((line) => `- ${line}`).join('\n');
  }
  if (normalizedTagName === 'blockquote') {
    return text.split('\n').filter(Boolean).map((line) => `> ${line}`).join('\n');
  }
  return text.split('\n').filter(Boolean).join('\n\n');
}

export function updatePreviewMarkdownBlock(
  markdown: string,
  sourceStart: number,
  sourceEnd: number,
  tagName: string,
  text: string
): string {
  const replacement = formatPreviewMarkdownBlock(tagName, text);
  if (markdown.slice(sourceStart, sourceEnd) === replacement) return markdown;
  return replaceSourceRange(markdown, sourceStart, sourceEnd, () => replacement);
}

export function updateMarkdownMediaBlockText(markdown: string, mediaIndex: number, text: string): string {
  if (!Number.isInteger(mediaIndex)) return markdown;

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

function insertPlainTextAtSelection(text: string): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  selection.deleteFromDocument();
  const textNode = document.createTextNode(text);
  const range = selection.getRangeAt(0);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
}

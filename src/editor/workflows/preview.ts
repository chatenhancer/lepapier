import type { EditorLayoutController } from '../../ui/editor-layout';
import type {
  EditorFieldElement,
  EditorFieldName
} from '../bindings/elements';
import {
  normalizeSmartPunctuationField as normalizeSmartPunctuationEditorField,
  normalizeSmartPunctuationFields as normalizeSmartPunctuationEditorFields
} from '../../markdown/smart-punctuation-fields';
import {
  type RenderMarkdownOptions,
  renderMarkdown as renderMarkdownPreview
} from '../../markdown/markdown-renderer';
import {
  getSelectionRange,
  replaceSelection
} from '../../markdown/selection';
import {
  applyToolbarFormattingToSource,
  createToolbarFormattingSnippet
} from '../../markdown/toolbar-formatting';
import { renderDocumentPreview as renderDocumentPreviewHtml } from '../../preview/document-preview';
import { getPreviewSelectionSourceRange } from '../../preview/preview-selection';
import type { ImageAsset } from '../../shared/types';

export interface EditorPreviewWorkflow {
  insertFormatting(type: string): void;
  normalizeFieldSmartPunctuation(field: EditorFieldElement, fieldName: EditorFieldName): void;
  normalizeSmartPunctuationFields(options?: { record?: boolean }): void;
  renderMarkdown(markdown: string, options?: RenderMarkdownOptions): string;
  renderPreview(): void;
  renderPreviewMode(options?: { focusWrite?: boolean }): void;
}

export interface EditorPreviewWorkflowOptions {
  attachPreviewImageEditor(): void;
  attachPreviewTextEditor(): void;
  bodyInput: HTMLTextAreaElement;
  editorLayout: EditorLayoutController;
  fields: Map<EditorFieldName, EditorFieldElement>;
  getCoverImage(): ImageAsset | null;
  getFieldValue(name: EditorFieldName): string;
  isPreviewActive(): boolean;
  isSmartPunctuationEnabled(): boolean;
  preview: HTMLElement;
  previewToggle: HTMLButtonElement;
  recordHistory(): void;
  resolveAssetUrl(path: string): string;
  scheduleMetadata(): void;
  setFieldValue(name: EditorFieldName, value: string): void;
  setPreviewActive(value: boolean): void;
  sync(): void;
}

export function createEditorPreviewWorkflow({
  attachPreviewImageEditor,
  attachPreviewTextEditor,
  bodyInput,
  editorLayout,
  fields,
  getCoverImage,
  getFieldValue,
  isPreviewActive,
  isSmartPunctuationEnabled,
  preview,
  previewToggle,
  recordHistory,
  resolveAssetUrl,
  scheduleMetadata,
  setFieldValue,
  setPreviewActive,
  sync
}: EditorPreviewWorkflowOptions): EditorPreviewWorkflow {
  const renderMarkdown = (markdown: string, options: RenderMarkdownOptions = {}) => {
    return renderMarkdownPreview(markdown, {
      ...options,
      resolveAssetUrl
    });
  };

  const getPreviewCover = (): { alt: string; src: string } | null => {
    const coverImage = getCoverImage();
    if (!coverImage?.url) return null;

    return {
      alt: getFieldValue('title') || 'Document cover',
      src: coverImage.url
    };
  };

  const renderDocumentPreview = () => renderDocumentPreviewHtml({
    body: getFieldValue('body'),
    cover: getPreviewCover(),
    date: getFieldValue('date'),
    description: getFieldValue('description'),
    renderMarkdown,
    tags: getFieldValue('tags'),
    title: getFieldValue('title')
  });

  const renderPreview = () => {
    preview.innerHTML = renderDocumentPreview();
    attachPreviewTextEditor();
    attachPreviewImageEditor();
  };

  const renderPreviewMode = ({ focusWrite = true }: { focusWrite?: boolean } = {}) => {
    const previewActive = isPreviewActive();
    previewToggle.setAttribute('aria-pressed', String(previewActive));
    const previewToggleText = previewToggle.querySelector('span');
    if (previewToggleText) {
      previewToggleText.textContent = previewActive ? 'Write' : 'Preview';
    }
    bodyInput.hidden = previewActive;
    preview.hidden = !previewActive;
    if (previewActive) {
      renderPreview();
    } else if (focusWrite) {
      editorLayout.resizeBodyInput();
      bodyInput.focus();
    } else {
      editorLayout.resizeBodyInput();
    }
  };

  const normalizeFieldSmartPunctuation = (field: EditorFieldElement, fieldName: EditorFieldName) => {
    if (!isSmartPunctuationEnabled()) return;
    normalizeSmartPunctuationEditorField(fieldName, field);
  };

  const normalizeSmartPunctuationFields = ({ record = false }: { record?: boolean } = {}) => {
    if (!isSmartPunctuationEnabled()) return;

    const changed = normalizeSmartPunctuationEditorFields({
      getField: (fieldName) => fields.get(fieldName),
      onFirstChange: record ? recordHistory : undefined
    });
    if (changed) {
      editorLayout.resizeBodyInput();
    }
  };

  const getRenderedPreviewSelectionSourceRange = () => getPreviewSelectionSourceRange({
    body: fields.get('body')?.value || '',
    preview
  });

  const applyPreviewFormatting = (type: string): boolean => {
    const selectionRange = getRenderedPreviewSelectionSourceRange();
    if (!selectionRange) return false;

    const updatedBody = applyToolbarFormattingToSource(type, selectionRange);
    if (!updatedBody || updatedBody === selectionRange.body) return false;

    recordHistory();
    setFieldValue('body', updatedBody);
    selectionRange.selection.removeAllRanges();
    sync();
    scheduleMetadata();
    return true;
  };

  const insertFormatting = (type: string) => {
    if (isPreviewActive()) {
      if (applyPreviewFormatting(type)) {
        return;
      }
      setPreviewActive(false);
      renderPreviewMode();
    }

    const selection = getSelectionRange(bodyInput);
    const selected = bodyInput.value.slice(selection.start, selection.end);

    recordHistory();
    replaceSelection(bodyInput, createToolbarFormattingSnippet(type, selected));
    sync();
    scheduleMetadata();
  };

  return {
    insertFormatting,
    normalizeFieldSmartPunctuation,
    normalizeSmartPunctuationFields,
    renderMarkdown,
    renderPreview,
    renderPreviewMode
  };
}

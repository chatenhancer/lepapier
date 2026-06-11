import type { DocumentFields } from '../../shared/types';

export type EditorFieldElement = HTMLInputElement | HTMLTextAreaElement;
export type EditorFieldName = keyof DocumentFields;

export interface EditorElements {
  addDocumentButton: HTMLButtonElement;
  aiEnableButton: HTMLButtonElement;
  aiRegenerateButtons: HTMLButtonElement[];
  aiStatus: HTMLElement;
  bodyInput: HTMLTextAreaElement;
  bugReportCopyButton: HTMLButtonElement;
  copyMarkdownButton: HTMLButtonElement;
  coverPath: HTMLElement;
  coverPicker: HTMLInputElement;
  coverPreview: HTMLElement;
  coverStatus: HTMLElement;
  deleteSelectedButton: HTMLButtonElement;
  documentCount: HTMLElement;
  documentList: HTMLElement;
  documentsSidebar: HTMLElement;
  downloadAllButtons: HTMLButtonElement[];
  downloadButtons: HTMLButtonElement[];
  editorHeader: HTMLElement;
  fieldElements: EditorFieldElement[];
  imageList: HTMLElement;
  imagePicker: HTMLInputElement;
  imageTemplate: HTMLTemplateElement;
  insertButtons: HTMLButtonElement[];
  mobileDocumentsToggle: HTMLButtonElement;
  mobileSettingsToggle: HTMLButtonElement;
  openDocumentButton: HTMLButtonElement;
  openDocumentFileInput: HTMLInputElement;
  openDocumentFileActionButton: HTMLButtonElement;
  openDocumentFolderButton: HTMLButtonElement;
  openDocumentMenu: HTMLElement;
  openEditableFileButton: HTMLButtonElement;
  openEditableFolderButton: HTMLButtonElement;
  openEditableFolderActionButton: HTMLButtonElement;
  openEditableFolderMenu: HTMLElement;
  output: HTMLElement;
  paper: HTMLElement;
  paperResizeHandles: HTMLElement[];
  preview: HTMLElement;
  previewToggle: HTMLButtonElement;
  randomizeImageNamesInput: HTMLInputElement;
  resetButton: HTMLButtonElement;
  saveState: HTMLElement;
  selectAllDocumentsInput: HTMLInputElement;
  sidebar: HTMLElement;
  smartPunctuationInput: HTMLInputElement;
  themeToggle: HTMLButtonElement;
  toolbar: HTMLElement;
  tooltipLayer: HTMLElement;
  writingColumn: HTMLElement;
}

export function getEditorElements(): EditorElements {
  return {
    addDocumentButton: requireElement<HTMLButtonElement>('[data-add-document]'),
    aiEnableButton: requireElement<HTMLButtonElement>('[data-ai-enable]'),
    aiRegenerateButtons: queryElements<HTMLButtonElement>('[data-ai-regenerate]'),
    aiStatus: requireElement<HTMLElement>('[data-ai-status]'),
    bodyInput: requireElement<HTMLTextAreaElement>('[data-field="body"]'),
    bugReportCopyButton: requireElement<HTMLButtonElement>('[data-copy-bug-report]'),
    copyMarkdownButton: requireElement<HTMLButtonElement>('[data-copy]'),
    coverPath: requireElement<HTMLElement>('[data-cover-path]'),
    coverPicker: requireElement<HTMLInputElement>('[data-cover-picker]'),
    coverPreview: requireElement<HTMLElement>('[data-cover-preview]'),
    coverStatus: requireElement<HTMLElement>('[data-cover-status]'),
    deleteSelectedButton: requireElement<HTMLButtonElement>('[data-delete-selected]'),
    documentCount: requireElement<HTMLElement>('[data-document-count]'),
    documentList: requireElement<HTMLElement>('[data-document-list]'),
    documentsSidebar: requireElement<HTMLElement>('[data-documents-sidebar]'),
    downloadAllButtons: queryElements<HTMLButtonElement>('[data-download-all]'),
    downloadButtons: queryElements<HTMLButtonElement>('[data-download]'),
    editorHeader: requireElement<HTMLElement>('.editor-header'),
    fieldElements: queryElements<EditorFieldElement>('[data-field]'),
    imageList: requireElement<HTMLElement>('[data-image-list]'),
    imagePicker: requireElement<HTMLInputElement>('[data-image-picker]'),
    imageTemplate: requireElement<HTMLTemplateElement>('[data-image-row-template]'),
    insertButtons: queryElements<HTMLButtonElement>('[data-insert]'),
    mobileDocumentsToggle: requireElement<HTMLButtonElement>('[data-mobile-panel-toggle="documents"]'),
    mobileSettingsToggle: requireElement<HTMLButtonElement>('[data-mobile-panel-toggle="settings"]'),
    openDocumentButton: requireElement<HTMLButtonElement>('[data-open-document]'),
    openDocumentFileInput: requireElement<HTMLInputElement>('[data-open-document-file]'),
    openDocumentFileActionButton: requireElement<HTMLButtonElement>('[data-open-document-file-action]'),
    openDocumentFolderButton: requireElement<HTMLButtonElement>('[data-open-document-folder]'),
    openDocumentMenu: requireElement<HTMLElement>('[data-open-menu="open"]'),
    openEditableFileButton: requireElement<HTMLButtonElement>('[data-open-editable-file]'),
    openEditableFolderButton: requireElement<HTMLButtonElement>('[data-open-editable-folder]'),
    openEditableFolderActionButton: requireElement<HTMLButtonElement>('[data-open-editable-folder-action]'),
    openEditableFolderMenu: requireElement<HTMLElement>('[data-open-menu="sync"]'),
    output: requireElement<HTMLElement>('[data-output]'),
    paper: requireElement<HTMLElement>('.paper'),
    paperResizeHandles: queryElements<HTMLElement>('[data-paper-resize]'),
    preview: requireElement<HTMLElement>('[data-preview]'),
    previewToggle: requireElement<HTMLButtonElement>('[data-preview-toggle]'),
    randomizeImageNamesInput: requireElement<HTMLInputElement>('[data-randomize-image-names]'),
    resetButton: requireElement<HTMLButtonElement>('[data-reset]'),
    saveState: requireElement<HTMLElement>('[data-save-state]'),
    selectAllDocumentsInput: requireElement<HTMLInputElement>('[data-select-all-documents]'),
    sidebar: requireElement<HTMLElement>('[data-sidebar]'),
    smartPunctuationInput: requireElement<HTMLInputElement>('[data-smart-punctuation]'),
    themeToggle: requireElement<HTMLButtonElement>('[data-theme-toggle]'),
    toolbar: requireElement<HTMLElement>('.toolbar'),
    tooltipLayer: requireElement<HTMLElement>('[data-tooltip-layer]'),
    writingColumn: requireElement<HTMLElement>('.writing-column')
  };
}

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required editor element: ${selector}`);
  }
  return element;
}

function queryElements<T extends Element>(selector: string): T[] {
  return Array.from(document.querySelectorAll<T>(selector));
}

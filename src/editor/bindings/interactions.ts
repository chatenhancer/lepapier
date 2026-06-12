import { getElement } from '../../dom/elements';
import {
  getClipboardMediaFiles,
  isSupportedMediaFile,
  setupMediaDropZone
} from '../../media/media-assets';
import { createCopyButtonFeedback } from '../../ui/feedback';

export interface EditorInteractionOptions {
  addDocument(): void;
  addDocumentButton: HTMLButtonElement;
  addMediaFile(file: File): unknown;
  bodyInput: HTMLTextAreaElement;
  bugReportCopyButton: HTMLButtonElement;
  buildBugReportDetails(): string;
  buildMarkdown(): string;
  closeMobilePanels(): void;
  copyFeedbackMs: number;
  copyMarkdownButton: HTMLButtonElement;
  coverPicker: HTMLInputElement;
  deleteDocument(documentId: string): void;
  deleteSelectedButton: HTMLButtonElement;
  deleteSelectedDocuments(): void;
  documentList: HTMLElement;
  downloadDocument(): void;
  downloadButtons: HTMLButtonElement[];
  mediaPicker: HTMLInputElement;
  insertButtons: HTMLButtonElement[];
  insertDroppedMedia(files: File[]): void;
  insertFormatting(type: string): void;
  isPreviewActive(): boolean;
  normalizeSmartPunctuationFields(options: { force?: boolean; record?: boolean }): boolean;
  openDocumentButton: HTMLButtonElement;
  openDocumentFileInput: HTMLInputElement;
  openDocumentFileActionButton: HTMLButtonElement;
  openDocumentFolder(): void;
  openDocumentFolderButton: HTMLButtonElement;
  openDocumentMenu: HTMLElement;
  openEditableFile(): void;
  openEditableFileButton: HTMLButtonElement;
  openEditableFolder(): void;
  openEditableFolderButton: HTMLButtonElement;
  openEditableFolderActionButton: HTMLButtonElement;
  openEditableFolderMenu: HTMLElement;
  openDocumentFiles(files: File[]): void;
  paper: HTMLElement;
  persistDraft(): void;
  previewToggle: HTMLButtonElement;
  randomizeMediaNamesInput: HTMLInputElement;
  recordHistory(): void;
  reconnectEditableFolder(documentId: string): void;
  renderMedia(): void;
  resetWorkspace(): void;
  resetButton: HTMLButtonElement;
  setCoverFile(file: File): void;
  showSaveState(text: string): void;
  selectAllDocumentsInput: HTMLInputElement;
  smartPunctuationInput: HTMLInputElement;
  smartPunctuationReplaceButton: HTMLButtonElement;
  switchDocument(documentId: string): void;
  sync(): void;
  toggleAllDocumentSelection(selected: boolean): void;
  toggleDocumentSelection(documentIds: string[], selected: boolean): void;
  togglePreviewMode(): void;
}

export function setupEditorInteractions({
  addDocument,
  addDocumentButton,
  addMediaFile,
  bodyInput,
  bugReportCopyButton,
  buildBugReportDetails,
  buildMarkdown,
  closeMobilePanels,
  copyFeedbackMs,
  copyMarkdownButton,
  coverPicker,
  deleteDocument,
  deleteSelectedButton,
  deleteSelectedDocuments,
  documentList,
  downloadDocument,
  downloadButtons,
  mediaPicker,
  insertButtons,
  insertDroppedMedia,
  insertFormatting,
  isPreviewActive,
  normalizeSmartPunctuationFields,
  openDocumentButton,
  openDocumentFileInput,
  openDocumentFileActionButton,
  openDocumentFolder,
  openDocumentFolderButton,
  openDocumentMenu,
  openEditableFile,
  openEditableFileButton,
  openEditableFolder,
  openEditableFolderButton,
  openEditableFolderActionButton,
  openEditableFolderMenu,
  openDocumentFiles,
  paper,
  persistDraft,
  previewToggle,
  randomizeMediaNamesInput,
  recordHistory,
  reconnectEditableFolder,
  renderMedia,
  resetWorkspace,
  resetButton,
  setCoverFile,
  showSaveState,
  selectAllDocumentsInput,
  smartPunctuationInput,
  smartPunctuationReplaceButton,
  switchDocument,
  sync,
  toggleAllDocumentSelection,
  toggleDocumentSelection,
  togglePreviewMode
}: EditorInteractionOptions): void {
  const showCopyFeedback = createCopyButtonFeedback({ feedbackMs: copyFeedbackMs }).show;
  let lastSelectedDocumentId = '';
  const closeOpenMenus = () => {
    openDocumentMenu.hidden = true;
    openEditableFolderMenu.hidden = true;
    openDocumentButton.setAttribute('aria-expanded', 'false');
    openEditableFolderButton.setAttribute('aria-expanded', 'false');
  };

  const toggleMenu = (button: HTMLButtonElement, menu: HTMLElement) => {
    const nextOpen = menu.hidden;
    closeOpenMenus();
    menu.hidden = !nextOpen;
    button.setAttribute('aria-expanded', String(nextOpen));
  };

  resetButton.addEventListener('click', resetWorkspace);
  deleteSelectedButton.addEventListener('click', deleteSelectedDocuments);
  selectAllDocumentsInput.addEventListener('change', () => {
    toggleAllDocumentSelection(selectAllDocumentsInput.checked);
  });

  copyMarkdownButton.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const copied = await copyTextToClipboard(buildMarkdown());
    if (!copied) {
      showSaveState('Copy unavailable');
      return;
    }
    showCopyFeedback(copyMarkdownButton);
    showSaveState('Copied Markdown');
  });

  bugReportCopyButton.addEventListener('click', async () => {
    const copied = await copyTextToClipboard(buildBugReportDetails());
    if (!copied) {
      showSaveState('Copy unavailable');
      return;
    }
    showCopyFeedback(bugReportCopyButton, {
      copiedLabel: 'Copied bug report details',
      defaultLabel: 'Copy bug report details',
      defaultTitle: 'Copy bug report details'
    });
    showSaveState('Copied bug report details');
  });

  for (const button of downloadButtons) {
    button.addEventListener('click', () => {
      downloadDocument();
    });
  }

  addDocumentButton.addEventListener('click', addDocument);
  openDocumentButton.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleMenu(openDocumentButton, openDocumentMenu);
  });
  openEditableFolderButton.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleMenu(openEditableFolderButton, openEditableFolderMenu);
  });
  openDocumentFileActionButton.addEventListener('click', () => {
    closeOpenMenus();
    openDocumentFileInput.click();
  });
  openDocumentFolderButton.addEventListener('click', () => {
    closeOpenMenus();
    openDocumentFolder();
  });
  openEditableFileButton.addEventListener('click', () => {
    closeOpenMenus();
    openEditableFile();
  });
  openEditableFolderActionButton.addEventListener('click', () => {
    closeOpenMenus();
    openEditableFolder();
  });
  document.addEventListener('click', closeOpenMenus);
  openDocumentFileInput.addEventListener('change', () => {
    const files = Array.from(openDocumentFileInput.files || []);
    openDocumentFileInput.value = '';
    if (!files.length) return;
    openDocumentFiles(files);
  });

  documentList.addEventListener('click', (event) => {
    const target = getElement(event.target);
    const selectionInput = target?.closest<HTMLInputElement>('[data-select-document]');
    if (selectionInput?.dataset.selectDocument) {
      const documentIds = event.shiftKey
        ? getDocumentSelectionRange(documentList, lastSelectedDocumentId, selectionInput.dataset.selectDocument)
        : [selectionInput.dataset.selectDocument];
      toggleDocumentSelection(documentIds, selectionInput.checked);
      lastSelectedDocumentId = selectionInput.dataset.selectDocument;
      event.stopPropagation();
      return;
    }

    const reconnectButton = target?.closest<HTMLElement>('[data-reconnect-folder]');
    if (reconnectButton?.dataset.reconnectFolder) {
      reconnectEditableFolder(reconnectButton.dataset.reconnectFolder);
      return;
    }

    const deleteButton = target?.closest<HTMLElement>('[data-delete-document]');
    if (deleteButton?.dataset.deleteDocument) {
      deleteDocument(deleteButton.dataset.deleteDocument);
      return;
    }

    const documentButton = target?.closest<HTMLElement>('[data-switch-document]');
    if (documentButton?.dataset.switchDocument) {
      switchDocument(documentButton.dataset.switchDocument);
      closeMobilePanels();
    }
  });

  previewToggle.addEventListener('click', togglePreviewMode);
  randomizeMediaNamesInput.addEventListener('change', persistDraft);
  smartPunctuationInput.addEventListener('change', () => {
    if (smartPunctuationInput.checked) {
      normalizeSmartPunctuationFields({ record: true });
      sync();
      return;
    }

    persistDraft();
  });
  smartPunctuationReplaceButton.addEventListener('click', () => {
    const changed = normalizeSmartPunctuationFields({ force: true, record: true });
    if (changed) {
      sync();
      showSaveState('Replaced smart punctuation');
      return;
    }

    showSaveState('Smart punctuation already clean');
  });

  for (const button of insertButtons) {
    button.addEventListener('pointerdown', (event) => {
      if (isPreviewActive()) {
        event.preventDefault();
      }
    });
    button.addEventListener('click', () => {
      insertFormatting(button.dataset.insert || '');
    });
  }

  coverPicker.addEventListener('change', () => {
    const file = coverPicker.files?.[0];
    if (file?.type.startsWith('image/')) {
      recordHistory();
      setCoverFile(file);
    }
    coverPicker.value = '';
    sync();
  });

  mediaPicker.addEventListener('change', () => {
    const files = Array.from(mediaPicker.files || []);
    if (files.some(isSupportedMediaFile)) {
      recordHistory();
    }
    for (const file of files) {
      addMediaFile(file);
    }
    mediaPicker.value = '';
    renderMedia();
    sync();
  });

  setupMediaDropZone(coverPicker.closest('.file-drop'), {
    multiple: false,
    onFiles(files: File[]) {
      if (!files[0]?.type.startsWith('image/')) return;
      recordHistory();
      setCoverFile(files[0]);
      sync();
    }
  });

  setupMediaDropZone(mediaPicker.closest('.file-drop'), {
    multiple: true,
    onFiles(files: File[]) {
      recordHistory();
      for (const file of files) {
        addMediaFile(file);
      }
      renderMedia();
      sync();
    }
  });

  setupMediaDropZone(paper, {
    multiple: true,
    onFiles(files: File[]) {
      insertDroppedMedia(files);
    }
  });

  bodyInput.addEventListener('paste', (event: ClipboardEvent) => {
    const files = getClipboardMediaFiles(event.clipboardData);
    if (!files.length) return;

    event.preventDefault();
    insertDroppedMedia(files);
  });
}

export function getDocumentSelectionRange(root: HTMLElement, fromDocumentId: string, toDocumentId: string): string[] {
  const documentIds = Array.from(root.querySelectorAll<HTMLInputElement>('[data-select-document]'))
    .map((input) => input.dataset.selectDocument)
    .filter((documentId): documentId is string => Boolean(documentId));
  const fromIndex = documentIds.indexOf(fromDocumentId);
  const toIndex = documentIds.indexOf(toDocumentId);
  if (fromIndex < 0 || toIndex < 0) return [toDocumentId];

  const start = Math.min(fromIndex, toIndex);
  const end = Math.max(fromIndex, toIndex);
  return documentIds.slice(start, end + 1);
}

export interface BugReportDetails {
  buildTimestamp: string;
  displayVersion: string;
  pageHref: string;
  releaseNotesHref: string;
  userAgent: string;
}

export function createBugReportDetails({
  buildTimestamp,
  displayVersion,
  pageHref,
  releaseNotesHref,
  userAgent
}: BugReportDetails): string {
  return [
    'Lepapier bug report',
    `Version: ${displayVersion}`,
    `Build date: ${buildTimestamp}`,
    `Release notes: ${releaseNotesHref}`,
    `App URL: ${pageHref || 'unknown'}`,
    `User agent: ${userAgent || 'unknown'}`,
    '',
    'What happened:',
    '',
    'What I expected:',
    '',
    'Steps to reproduce:',
    '1. '
  ].join('\n');
}

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) {
    return copyTextWithSelection(text);
  }

  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return copyTextWithSelection(text);
  }
}

function copyTextWithSelection(text: string): boolean {
  const activeElement = document.activeElement;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.left = '-9999px';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';
  textarea.style.position = 'fixed';
  textarea.style.top = '0';
  document.body.append(textarea);
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

  try {
    return document.execCommand('copy');
  } finally {
    textarea.remove();
    if (activeElement instanceof HTMLElement) {
      activeElement.focus();
    }
  }
}

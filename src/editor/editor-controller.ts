import { appConfig } from '../app-config';
import { createEditorHistory } from '../app/editor-history';
import { createEditorSession } from './session';
import {
  normalizeWorkspaceDraft
} from '../app/workspace-state';
import {
  createImportedDocument,
  type ImportedDocument
} from '../documents/imported-document';
import {
  ensureEditableFilePermission as ensureEditableFilePermissionFromHandle,
  ensureEditableFolderPermission as ensureEditableFolderPermissionFromHandle,
  getEditableFilePermissionState as getEditableFilePermissionStateFromHandle,
  getEditableFolderPermissionState as getEditableFolderPermissionStateFromHandle
} from '../filesystem/editable-folder';
import {
  getClipboardImages
} from '../images/image-assets';
import {
  createAssetId,
  createRestoredImageAsset,
  assetMatchesPath
} from '../images/image-library';
import {
  getElement,
  isEditableTarget
} from '../dom/elements';
import { setupChromeAiMetadataController } from '../metadata/chrome-ai-metadata-controller';
import { getToday } from '../shared/date';
import type {
  AssetMetadata,
  DocumentSourceMode,
  ImageAsset,
  DocumentRecord,
  WorkspaceDraft
} from '../shared/types';
import {
  buildDocumentMarkdown
} from '../documents/document-markdown';
import {
  createImportAssetRegistry,
  type ImportedAssetRegistry,
  isImportImageFile
} from '../documents/document-import';
import {
  formatDocumentCount,
  renderDocumentList
} from '../documents/document-list-view';
import { setupPreviewImageEditor } from '../preview/preview-image-editor';
import { setupPreviewTextEditor } from '../preview/preview-text-editor';
import { setupEditorLayoutController } from '../ui/editor-layout';
import {
  createSaveStateFeedback
} from '../ui/feedback';
import { setupMobilePanels } from '../ui/mobile-panels';
import { setupPaperResizeController } from '../ui/paper-resize';
import { setupThemeController } from '../ui/theme-controller';
import { setupTooltipController } from '../ui/tooltip-controller';
import { createTransientReveal } from '../ui/transient-reveal';
import { bindTransientRevealTriggers } from '../ui/transient-reveal-triggers';
import {
  createEditorSnapshot as createEditorSnapshotFromState,
  type EditorSnapshot,
  getEditorSnapshotSignature,
  updateDocumentFromEditor as updateDocumentFromEditorState,
  writeEditorFields
} from './bindings/document-binding';
import {
  createEditorDocumentActions
} from './workflows/document-actions';
import {
  createEditorDraftPersistence
} from './workflows/draft-persistence';
import { createEditorEditableFolderFiles } from './workflows/editable-folder-files';
import {
  getEditorElements,
  type EditorFieldElement,
  type EditorFieldName
} from './bindings/elements';
import {
  createBugReportDetails,
  setupEditorInteractions
} from './bindings/interactions';
import { createEditorDownloadWorkflow } from './workflows/download';
import {
  createEditorExportAssetWorkflow
} from './workflows/export-assets';
import { bindEditorFieldInputs } from './bindings/field-inputs';
import {
  createEditorFolderSync
} from './workflows/folder-sync';
import { createEditorMediaWorkflow } from './workflows/media';
import { createEditorOpenWorkflow } from './workflows/open';
import {
  createEditorPreviewWorkflow
} from './workflows/preview';
import { createEditorStorage } from './storage';

export function startEditorController(): void {
  const copyFeedbackMs = 1400;
  const downloadAnimationFallbackMs = 1700;
  const defaultPaperWidth = 800;
  const darkThemeColor = '#000000';
  const lightThemeColor = '#ffffff';
  const maximumHistoryEntries = 100;
  const maximumPaperWidth = 920;
  const minimumPaperWidth = 540;
  const themeStorageKey = `${appConfig.storageNamespace}-theme`;
  const editorStorage = createEditorStorage({ storageNamespace: appConfig.storageNamespace });
  const fields = new Map<EditorFieldName, EditorFieldElement>();

  const {
    addDocumentButton,
    aiEnableButton,
    aiRegenerateButtons,
    aiStatus,
    bodyInput,
    bugReportCopyButton,
    copyMarkdownButton,
    coverPath,
    coverPicker,
    coverPreview,
    coverStatus,
    deleteSelectedButton,
    documentCount,
    documentList,
    documentsSidebar,
    downloadButtons,
    editorHeader,
    fieldElements,
    imageList,
    imagePicker,
    imageTemplate,
    insertButtons,
    mobileDocumentsToggle,
    mobileSettingsToggle,
    openDocumentButton,
    openDocumentFileActionButton,
    openDocumentFileInput,
    openDocumentFolderButton,
    openDocumentMenu,
    openEditableFileButton,
    openEditableFolderButton,
    openEditableFolderActionButton,
    openEditableFolderMenu,
    output,
    paper,
    paperResizeHandles,
    preview,
    previewToggle,
    randomizeImageNamesInput,
    resetButton,
    saveState,
    selectAllDocumentsInput,
    sidebar,
    smartPunctuationInput,
    smartPunctuationReplaceButton,
    themeToggle,
    toolbar,
    tooltipLayer,
    writingColumn
  } = getEditorElements();
  const mobilePanelsQuery = window.matchMedia('(max-width: 760px)');
  const saveStateFeedback = createSaveStateFeedback({ element: saveState });
  const showSaveState = saveStateFeedback.show;
  let selectedDocumentCount = 0;
  const documentsSidebarReveal = createTransientReveal({
    elements: [documentsSidebar],
    shouldStayRevealed: () => selectedDocumentCount > 0 || documentsSidebar.matches(':hover, :focus-within')
  });
  const sidebarReveal = createTransientReveal({ elements: [sidebar] });
  const toolbarReveal = createTransientReveal({
    asleepClassName: null,
    elements: [toolbar, editorHeader]
  });
  let getSessionPaperWidth = () => defaultPaperWidth;
  const session = createEditorSession({
    createDocumentId,
    defaultPaperWidth,
    getPaperWidth: () => getSessionPaperWidth(),
    maximumPaperWidth,
    minimumPaperWidth
  });
  const editorLayout = setupEditorLayoutController({
    bodyInput,
    defaultPaperWidth,
    documentsSidebarReveal,
    isPreviewActive: () => session.isPreviewActive(),
    maximumPaperWidth,
    minimumPaperWidth,
    paper,
    sidebar,
    sidebarReveal
  });
  getSessionPaperWidth = editorLayout.getPaperWidth;
  const editorHistory = createEditorHistory<EditorSnapshot>({
    createSnapshot: createEditorSnapshot,
    getSignature: getSnapshotSignature,
    maximumEntries: maximumHistoryEntries,
    restoreSnapshot: restoreEditorSnapshot
  });
  const draftPersistence = createEditorDraftPersistence({
    documents: session.documents,
    getActiveDocumentId: session.getActiveDocumentId,
    getRandomizeImageNames: () => randomizeImageNamesInput.checked,
    getSmartPunctuation: () => smartPunctuationInput.checked,
    images: session.selectedImages,
    logError: logEditorError,
    renderDocumentsList,
    showSaveState,
    updateActiveDocument: updateActiveDocumentFromEditor,
    writeDraft: (draft) => {
      editorStorage.writeDraft(draft);
    }
  });
  const mobilePanels = setupMobilePanels({
    documentsToggle: mobileDocumentsToggle,
    mediaQuery: mobilePanelsQuery,
    onLayoutChange: renderDocumentsList,
    settingsToggle: mobileSettingsToggle
  });
  const paperResize = setupPaperResizeController({
    defaultWidth: defaultPaperWidth,
    getWidth: editorLayout.getPaperWidth,
    handles: paperResizeHandles,
    onCommit: persistDraft,
    onRecordHistory: editorHistory.record,
    paper,
    setWidth: editorLayout.setPaperWidth
  });
  const editableFolderFiles = createEditorEditableFolderFiles({
    isImageFile: isImportImageFile,
    logError: logEditorError
  });
  const chromeAiMetadata = setupChromeAiMetadataController({
    enableButton: aiEnableButton,
    getFieldValue,
    isSlugEdited: () => session.getEditState().slug,
    markDescriptionEdited: () => {
      session.markFieldEdited('description');
    },
    markTagsEdited: () => {
      session.markFieldEdited('tags');
    },
    markTitleEdited: () => {
      session.markFieldEdited('title');
    },
    recordHistory: editorHistory.record,
    regenerateButtons: aiRegenerateButtons,
    setFieldValue,
    status: aiStatus,
    sync
  });
  const previewTextEditor = setupPreviewTextEditor({
    getBody: () => fields.get('body')?.value || '',
    getFieldValue,
    isSlugEdited: () => session.getEditState().slug,
    isSmartPunctuationEnabled: () => smartPunctuationInput.checked,
    markDescriptionEdited: () => {
      session.markFieldEdited('description');
    },
    markTagsEdited: () => {
      session.markFieldEdited('tags');
    },
    markTitleEdited: () => {
      session.markFieldEdited('title');
    },
    preview,
    recordHistory: editorHistory.record,
    scheduleMetadata: chromeAiMetadata.schedule,
    setFieldValue,
    sync
  });
  const mediaWorkflow = createEditorMediaWorkflow({
    bodyInput,
    coverPath,
    coverPreview,
    coverStatus,
    createAssetId,
    getCoverImage: session.getCoverImage,
    getFieldValue,
    imageList,
    imageTemplate,
    isPreviewActive: session.isPreviewActive,
    exitPreviewMode,
    recordHistory: editorHistory.record,
    saveAsset: (asset) => editorStorage.saveAsset(asset),
    scheduleMetadata: () => {
      chromeAiMetadata.schedule();
    },
    selectedImages: session.selectedImages,
    setCoverImage: session.setCoverImage,
    setFieldValue,
    showSaveState,
    sync
  });
  const exportAssetWorkflow = createEditorExportAssetWorkflow({
    createAssetId,
    documents: session.documents,
    editableFolders: session.editableFolders,
    getActiveDocumentId: session.getActiveDocumentId,
    getCurrentAssetNames: mediaWorkflow.getCurrentAssetNames,
    getFileSourcePath: editableFolderFiles.getImportFilePath,
    getLiveAsset: session.getLiveAsset,
    isImageFile: isImportImageFile,
    logError: logEditorError,
    readEditableFolderFile: editableFolderFiles.readEditableFolderFile,
    renderCover: mediaWorkflow.renderCover,
    renderImages: mediaWorkflow.renderImages,
    restoreSavedAsset,
    saveAsset: (asset) => editorStorage.saveAsset(asset),
    selectedImages: session.selectedImages,
    setCoverImage: session.setCoverImage
  });
  const downloadWorkflow = createEditorDownloadWorkflow({
    fallbackMs: downloadAnimationFallbackMs,
    getPrimaryDocumentsForExport,
    isRandomizeImageNamesEnabled: () => randomizeImageNamesInput.checked,
    paper,
    resolveAssets: exportAssetWorkflow.getUniqueAssetFiles,
    saveDraft: saveDraftNow,
    showSaveState,
    writingColumn
  });
  const previewImageEditor = setupPreviewImageEditor({
    addImageFile: mediaWorkflow.addImageFile,
    getMarkdown: () => getFieldValue('body'),
    preview,
    recordHistory: editorHistory.record,
    renderImages: mediaWorkflow.renderImages,
    scheduleAiMetadata: () => {
      chromeAiMetadata.schedule();
    },
    setMarkdown: (markdown) => {
      setFieldValue('body', markdown);
    },
    sync
  });
  const previewWorkflow = createEditorPreviewWorkflow({
    attachPreviewImageEditor: previewImageEditor.attach,
    attachPreviewTextEditor: previewTextEditor.attach,
    bodyInput,
    editorLayout,
    fields,
    getCoverImage: session.getCoverImage,
    getFieldValue,
    isPreviewActive: session.isPreviewActive,
    isSmartPunctuationEnabled: () => smartPunctuationInput.checked,
    preview,
    previewToggle,
    recordHistory: editorHistory.record,
    resolveAssetUrl: mediaWorkflow.getPreviewAssetUrl,
    scheduleMetadata: chromeAiMetadata.schedule,
    setFieldValue,
    setPreviewActive: session.setPreviewActive,
    sync
  });
  const editorOpenWorkflow = createEditorOpenWorkflow({
    ensureEditableFilePermission: ensureEditableFilePermissionFromHandle,
    ensureEditableFolderPermission: ensureEditableFolderPermissionFromHandle,
    importDocumentFiles,
    readEditableFolderFiles: editableFolderFiles.readEditableFolderFiles,
    saveDraft: () => {
      saveDraftNow({ touch: false });
    },
    showSaveState
  });
  const documentActions = createEditorDocumentActions({
    applyDocumentToEditor,
    createDefaultDocument,
    deleteEditableFolderHandle: (documentId) => editorStorage.deleteEditableFolderHandle(documentId),
    documents: session.documents,
    editableFiles: session.editableFiles,
    editableFolders: session.editableFolders,
    getActiveDocument,
    getActiveDocumentId: session.getActiveDocumentId,
    getCurrentPaperWidth: editorLayout.getPaperWidth,
    getCurrentViewMode: () => session.isPreviewActive() ? 'preview' : 'write',
    renderDocumentsList,
    resetHistory: editorHistory.reset,
    saveDraft: saveDraftNow,
    selectedDocumentIds: session.selectedDocumentIds,
    setActiveDocumentId: session.setActiveDocumentId,
    sync
  });
  const folderSync = createEditorFolderSync({
    editableFiles: session.editableFiles,
    editableFolders: session.editableFolders,
    ensureEditableFilePermission: ensureEditableFilePermissionFromHandle,
    ensureEditableFolderPermission: ensureEditableFolderPermissionFromHandle,
    getCurrentDocumentForExport,
    getDocumentForExportById,
    logError: logEditorError,
    renderDocumentsList,
    saveDraft: saveDraftNow,
    showSaveState,
    validateEditableFolderDocument: (documentRecord, directoryHandle) => editableFolderFiles.validateEditableFolderDocument(
      documentRecord,
      directoryHandle,
      exportAssetWorkflow.getUniqueAssetFiles
    ),
    writeDocumentToEditableFile: (documentRecord, fileHandle) => editableFolderFiles.writeDocumentToEditableFile(
      documentRecord,
      fileHandle,
      exportAssetWorkflow.getUniqueAssetFiles
    ),
    writeDocumentToEditableFolder: (documentRecord, directoryHandle) => editableFolderFiles.writeDocumentToEditableFolder(
      documentRecord,
      directoryHandle,
      exportAssetWorkflow.getUniqueAssetFiles
    )
  });

  setupThemeController({
    appConfig,
    darkThemeColor,
    lightThemeColor,
    storageKey: themeStorageKey,
    themeToggle
  });

  bindEditorFieldInputs({
    fields,
    fieldElements,
    isSlugEdited: () => session.getEditState().slug,
    markFieldEdited,
    normalizeField: previewWorkflow.normalizeFieldSmartPunctuation,
    recordHistory: editorHistory.record,
    resizeBodyInput: editorLayout.resizeBodyInput,
    scheduleMetadata: chromeAiMetadata.schedule,
    setFieldValue,
    sync
  });

  setupTooltipController({ layer: tooltipLayer });
  document.addEventListener('keydown', handleEditorHistoryShortcut);
  document.addEventListener('paste', handlePreviewImagePaste);
  preview.addEventListener('pointerdown', handlePreviewPointerDown);

  editorLayout.updateToolbarScrollState();
  documentsSidebarReveal.revealTemporarily();
  sidebarReveal.revealTemporarily();
  toolbarReveal.revealTemporarily();
  window.addEventListener('scroll', editorLayout.updateToolbarScrollState, { passive: true });
  window.addEventListener('pointermove', handleSheetEdgePointerMove);
  window.addEventListener('blur', paperResize.clearVisibility);
  document.documentElement.addEventListener('pointerleave', paperResize.clearVisibility);
  window.addEventListener('resize', () => {
    editorLayout.scheduleSidebarAvoidanceUpdate();
    editorLayout.resizeBodyInput();
    if (!mobilePanels.isMobileLayout()) {
      mobilePanels.close();
    }
  });
  bindTransientRevealTriggers([
    { controller: sidebarReveal, element: sidebar },
    { controller: documentsSidebarReveal, element: documentsSidebar },
    { controller: toolbarReveal, element: toolbar },
    { controller: toolbarReveal, element: editorHeader }
  ]);
  setupEditorInteractions({
    addDocument: documentActions.addDocument,
    addDocumentButton,
    addImageFile: mediaWorkflow.addImageFile,
    bodyInput,
    bugReportCopyButton,
    buildBugReportDetails() {
      return createBugReportDetails({
        buildTimestamp: appConfig.buildTimestamp,
        displayVersion: appConfig.displayVersion,
        pageHref: window.location.href,
        releaseNotesHref: appConfig.releaseNotesHref,
        userAgent: navigator.userAgent
      });
    },
    buildMarkdown,
    closeMobilePanels: () => {
      mobilePanels.close();
    },
    copyFeedbackMs,
    copyMarkdownButton,
    coverPicker,
    deleteDocument: documentActions.deleteDocument,
    deleteSelectedButton,
    deleteSelectedDocuments,
    documentList,
    downloadDocument() {
      void downloadWorkflow.downloadDocument();
    },
    downloadButtons,
    imagePicker,
    insertButtons,
    insertDroppedImages: mediaWorkflow.insertDroppedImages,
    insertFormatting: previewWorkflow.insertFormatting,
    isPreviewActive: session.isPreviewActive,
    normalizeSmartPunctuationFields: previewWorkflow.normalizeSmartPunctuationFields,
    openDocumentButton,
    openDocumentFileActionButton,
    openDocumentFileInput,
    openDocumentFolder() {
      void editorOpenWorkflow.openDocumentFolder();
    },
    openDocumentFolderButton,
    openDocumentMenu,
    openEditableFile() {
      void editorOpenWorkflow.openEditableDocumentFile();
    },
    openEditableFileButton,
    openEditableFolder() {
      void editorOpenWorkflow.openEditableDocumentFolder();
    },
    openEditableFolderButton,
    openEditableFolderActionButton,
    openEditableFolderMenu,
    openDocumentFiles(files) {
      void editorOpenWorkflow.openDocumentFiles(files);
    },
    paper,
    persistDraft,
    previewToggle,
    randomizeImageNamesInput,
    recordHistory: editorHistory.record,
    reconnectEditableFolder(documentId) {
      void folderSync.reconnectEditableFolderForDocument(documentId);
    },
    renderImages: mediaWorkflow.renderImages,
    resetWorkspace,
    resetButton,
    setCoverFile: mediaWorkflow.setCoverFile,
    showSaveState,
    selectAllDocumentsInput,
    smartPunctuationInput,
    smartPunctuationReplaceButton,
    switchDocument: documentActions.switchDocument,
    sync,
    toggleAllDocumentSelection,
    toggleDocumentSelection,
    togglePreviewMode
  });

  const loadedDraft = loadDraft();
  mediaWorkflow.renderImages();
  mediaWorkflow.renderCover();
  previewWorkflow.renderPreviewMode({ focusWrite: false });
  sync({ persist: false });
  void restoreSavedAssets(loadedDraft);
  void restoreEditableFolders(loadedDraft);

  function renderDocumentsList(): void {
    const documentTotal = session.documents.length;
    documentCount.hidden = documentTotal <= 1;
    documentCount.textContent = String(documentTotal);
    documentCount.setAttribute('aria-label', formatDocumentCount(documentTotal));
    renderDocumentList({
      activeDocumentId: session.getActiveDocumentId(),
      compact: mobilePanelsQuery.matches,
      documents: session.documents,
      getEditableState(documentId) {
        return session.editableFolders.get(documentId) || session.editableFiles.get(documentId);
      },
      root: documentList,
      selectedDocumentIds: session.selectedDocumentIds
    });
    updateDownloadButtonLabels();
  }

  function updateDownloadButtonLabels(): void {
    const selectedCount = getSelectedDocuments().length;
    selectedDocumentCount = selectedCount;
    const label = selectedCount > 0
      ? selectedCount === 1 ? 'Download selected' : `Download selected (${selectedCount})`
      : 'Download';
    for (const button of downloadButtons) {
      button.textContent = label;
    }
    deleteSelectedButton.hidden = selectedCount === 0;
    deleteSelectedButton.textContent = selectedCount > 1 ? `Remove selected (${selectedCount})` : 'Remove selected';
    selectAllDocumentsInput.checked = selectedCount > 0 && selectedCount === session.documents.length;
    selectAllDocumentsInput.indeterminate = selectedCount > 0 && selectedCount < session.documents.length;
    documentsSidebar.classList.toggle('has-selection', selectedCount > 0);
  }

  function toggleDocumentSelection(documentIds: string[], selected: boolean): void {
    for (const documentId of documentIds) {
      if (selected) {
        session.selectedDocumentIds.add(documentId);
      } else {
        session.selectedDocumentIds.delete(documentId);
      }
    }
    renderDocumentsList();
  }

  function toggleAllDocumentSelection(selected: boolean): void {
    session.selectedDocumentIds.clear();
    if (selected) {
      for (const documentRecord of session.documents) {
        session.selectedDocumentIds.add(documentRecord.id);
      }
    }
    renderDocumentsList();
  }

  function deleteSelectedDocuments(): void {
    documentActions.deleteDocuments(Array.from(session.selectedDocumentIds));
  }

  function exitPreviewMode(): void {
    session.setPreviewActive(false);
    previewToggle.setAttribute('aria-pressed', 'false');
    const previewToggleText = previewToggle.querySelector('span');
    if (previewToggleText) {
      previewToggleText.textContent = 'Preview';
    }
    bodyInput.hidden = false;
    preview.hidden = true;
    editorLayout.resizeBodyInput();
    bodyInput.focus();
  }

  function resetWorkspace(): void {
    if (!window.confirm('Clear the saved local draft?')) return;
    editorHistory.record();
    editorStorage.clearDraft();
    void editorStorage.clearAssets();
    void editorStorage.clearEditableFolderHandles();
    const nextDocument = createDefaultDocument();
    session.resetWorkspace(nextDocument);
    randomizeImageNamesInput.checked = false;
    smartPunctuationInput.checked = true;
    applyDocumentToEditor(nextDocument, { focusWrite: false, restoreCover: false });
    previewWorkflow.renderPreviewMode({ focusWrite: false });
    renderDocumentsList();
    mediaWorkflow.renderImages();
    mediaWorkflow.renderCover();
    sync();
  }

  function togglePreviewMode(): void {
    session.togglePreviewActive();
    previewWorkflow.renderPreviewMode();
    persistDraft();
  }

  function loadDraft(): WorkspaceDraft {
    const fallback = createDefaultDocument();
    const saved = editorStorage.readDraft();
    const draft = normalizeWorkspaceDraft(saved, fallback, getNormalizeDocumentOptions());

    session.loadDraft(draft);
    randomizeImageNamesInput.checked = Boolean(draft.randomizeImageNames);
    smartPunctuationInput.checked = draft.smartPunctuation !== false;
    applyDocumentToEditor(getActiveDocument() || session.documents[0], { focusWrite: false, restoreCover: false });
    return draft;
  }

  function normalizeDocumentRecord(documentRecord: unknown): DocumentRecord | null {
    return session.normalizeDocumentRecord(documentRecord);
  }

  function createDefaultDocument(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
    return session.createDefaultDocument(overrides);
  }

  function getNormalizeDocumentOptions() {
    return {
      createDocumentId,
      defaultPaperWidth,
      maximumPaperWidth,
      minimumPaperWidth
    };
  }

  function createDocumentId(): string {
    if ('randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `document-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  async function restoreSavedAssets(draft: WorkspaceDraft): Promise<void> {
    const images = await Promise.all((draft?.images || []).map((asset) => restoreSavedAsset(asset)));

    session.replaceSelectedImages(images.filter((image): image is ImageAsset => Boolean(image)));
    mediaWorkflow.renderImages();
    await restoreActiveDocumentCover();
    sync({ persist: false });
  }

  async function restoreEditableFolders(draft: WorkspaceDraft): Promise<void> {
    if (!('indexedDB' in window)) return;

    await Promise.all((draft?.documents || []).map(async (documentRecord) => {
      try {
        const fileRecord = await editorStorage.readEditableFileHandle(documentRecord.id);
        if (fileRecord?.fileHandle) {
          const connected = await getEditableFilePermissionStateFromHandle(fileRecord.fileHandle) === 'granted';
          session.editableFiles.set(documentRecord.id, {
            connected,
            fileHandle: fileRecord.fileHandle
          });
          return;
        }

        const record = await editorStorage.readEditableFolderHandle(documentRecord.id);
        if (!record?.directoryHandle) return;
        const connected = await getEditableFolderPermissionStateFromHandle(record.directoryHandle) === 'granted';
        session.editableFolders.set(documentRecord.id, {
          connected,
          directoryHandle: record.directoryHandle
        });
      } catch {
        // Ignore stale or unsupported handles; the normal ZIP workflow still works.
      }
    }));

    renderDocumentsList();
  }

  async function restoreActiveDocumentCover(): Promise<void> {
    const documentRecord = getActiveDocument();
    const documentId = documentRecord?.id;
    const coverMetadata = documentRecord?.coverImage;
    session.setCoverImage(session.getLiveAsset(coverMetadata));
    mediaWorkflow.renderCover();

    if (!coverMetadata?.id || session.getCoverImage()) return;

    const restoredCover = await restoreSavedAsset(coverMetadata);
    if (session.getActiveDocumentId() !== documentId) return;

    session.setCoverImage(restoredCover);
    mediaWorkflow.renderCover();
  }

  async function restoreSavedAsset(metadata: AssetMetadata | null | undefined): Promise<ImageAsset | null> {
    if (!metadata?.id) return null;

    try {
      const record = await editorStorage.readAsset(metadata.id);
      if (!record?.file) return null;
      return createRestoredImageAsset(metadata, record.file);
    } catch {
      return null;
    }
  }

  function sync({ persist = true }: { persist?: boolean } = {}): void {
    const markdown = buildMarkdown();
    output.textContent = markdown;
    editorLayout.resizeBodyInput();
    if (session.isPreviewActive()) {
      previewWorkflow.renderPreview();
    }
    if (persist) {
      persistDraft();
    }
  }

  function persistDraft(): void {
    draftPersistence.persistDraft();
  }

  function saveDraftNow({ feedback = false, touch = true }: { feedback?: boolean; touch?: boolean } = {}): void {
    draftPersistence.saveDraftNow({ feedback, touch });
  }

  function logEditorError(message: string, error: unknown, details: Record<string, unknown> = {}): void {
    console.error(`[${appConfig.name}] ${message}`, details, error);
  }

  function getActiveDocument(): DocumentRecord | null {
    return session.getActiveDocument();
  }

  function markFieldEdited(fieldName: EditorFieldName): void {
    session.markFieldEdited(fieldName);
  }

  function updateActiveDocumentFromEditor({ touch }: { touch: boolean }): DocumentRecord | null {
    const documentRecord = getActiveDocument();
    if (!documentRecord) return null;

    return updateDocumentFromEditorState(documentRecord, {
      coverImage: session.getCoverImage(),
      editState: session.getEditState(),
      fields,
      paperWidth: editorLayout.getPaperWidth(),
      previewActive: session.isPreviewActive(),
      touch
    });
  }

  function applyDocumentToEditor(
    documentRecord: DocumentRecord | null,
    { focusWrite = true, restoreCover = true }: { focusWrite?: boolean; restoreCover?: boolean } = {}
  ): void {
    if (!documentRecord) return;

    writeEditorFields(fields, documentRecord.fields);
    if (!getFieldValue('date')) {
      setFieldValue('date', getToday());
    }

    session.setCoverImage(session.getLiveAsset(documentRecord.coverImage));
    session.setDocumentEditState(documentRecord.editState);
    session.setPreviewActive(documentRecord.viewMode === 'preview');
    editorLayout.setPaperWidth(documentRecord.paperWidth);
    previewWorkflow.renderPreviewMode({ focusWrite });
    mediaWorkflow.renderCover();
    renderDocumentsList();
    chromeAiMetadata.schedule();
    if (restoreCover) {
      void restoreActiveDocumentCover().then(() => {
        sync({ persist: false });
      });
    }
  }

  async function importDocumentFiles(
    markdownFiles: File[],
    files: File[],
    {
      directoryHandle,
      fileHandle,
      sourceMode
    }: {
      directoryHandle?: FileSystemDirectoryHandle;
      fileHandle?: FileSystemFileHandle;
      sourceMode: DocumentSourceMode;
    }
  ): Promise<void> {
    const importedDocuments: ImportedDocument[] = [];
    const importAssetRegistry = createImportAssetRegistry({
      existingAssetNames: mediaWorkflow.getCurrentAssetNames(),
      existingAssets: [session.getCoverImage(), ...session.selectedImages].filter((asset): asset is ImageAsset => Boolean(asset))
    });
    for (const markdownFile of markdownFiles) {
      const importedDocument = await createImportedDocumentFromFiles(markdownFile, await markdownFile.text(), files, sourceMode, importAssetRegistry);
      importedDocuments.push(importedDocument);
      addImportedImages(importedDocument.images);
      await saveImportedAssets(importedDocument.assets);
      session.addDocument(importedDocument.documentRecord);

      if (directoryHandle) {
        session.editableFolders.set(importedDocument.documentRecord.id, {
          connected: true,
          directoryHandle
        });
        await editorStorage.saveEditableFolderHandle(importedDocument.documentRecord.id, directoryHandle);
      }

      if (fileHandle) {
        session.editableFiles.set(importedDocument.documentRecord.id, {
          connected: true,
          fileHandle
        });
        await editorStorage.saveEditableFileHandle(importedDocument.documentRecord.id, fileHandle);
      }
    }
    if (!importedDocuments.length) return;

    const firstImportedDocument = importedDocuments[0];
    session.setActiveDocumentId(firstImportedDocument.documentRecord.id);
    session.setCoverImage(firstImportedDocument.coverImage);
    editorHistory.reset();
    applyDocumentToEditor(firstImportedDocument.documentRecord, { focusWrite: false, restoreCover: false });
    mediaWorkflow.renderImages();
    mediaWorkflow.renderCover();
    sync();
  }

  async function createImportedDocumentFromFiles(
    markdownFile: File,
    source: string,
    files: File[],
    sourceMode: DocumentSourceMode,
    assetRegistry: ImportedAssetRegistry
  ): Promise<ImportedDocument> {
    return createImportedDocument({
      assetRegistry,
      createAssetId,
      createDocumentId,
      existingAssetNames: mediaWorkflow.getCurrentAssetNames(),
      files,
      getFilePath: editableFolderFiles.getImportFilePath,
      markdownFile,
      normalizeDocumentRecord,
      paperWidth: editorLayout.getPaperWidth(),
      previewActive: session.isPreviewActive(),
      sourceMetadata: {
        markdownPath: editableFolderFiles.getImportFilePath(markdownFile) || markdownFile.name,
        mode: sourceMode
      },
      source
    });
  }

  async function saveImportedAssets(assets: ImageAsset[]): Promise<void> {
    await Promise.all(assets.map(async (asset) => {
      try {
        await editorStorage.saveAsset(asset);
      } catch {
        showSaveState('Some imported images could not be saved for refresh');
      }
    }));
  }

  function addImportedImages(images: ImageAsset[]): void {
    for (const image of images) {
      const alreadySelected = session.selectedImages.some((selectedImage) => {
        return selectedImage.id === image.id
          || assetMatchesPath(selectedImage, image.path)
          || assetMatchesPath(selectedImage, image.sourcePath);
      });
      if (!alreadySelected) {
        session.selectedImages.push(image);
      }
    }
  }

  function handleEditorHistoryShortcut(event: KeyboardEvent): void {
    if (event.key === 'Escape' && mobilePanels.isMobileLayout()) {
      mobilePanels.close();
      return;
    }

    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;

    const key = event.key.toLowerCase();
    if (key === 's') {
      event.preventDefault();
      void folderSync.saveCurrentDocument({ feedback: true });
      return;
    }

    if (key !== 'z') return;

    const action = event.shiftKey ? editorHistory.redo : editorHistory.undo;
    const canApplyAction = event.shiftKey ? editorHistory.canRedo() : editorHistory.canUndo();
    if (!canApplyAction) return;

    event.preventDefault();
    action();
  }

  function createEditorSnapshot(): EditorSnapshot {
    return createEditorSnapshotFromState({
      coverImage: session.getCoverImage(),
      editState: session.getEditState(),
      fields,
      images: session.selectedImages,
      paperWidth: editorLayout.getPaperWidth(),
      previewActive: session.isPreviewActive()
    });
  }

  function restoreEditorSnapshot(snapshot: EditorSnapshot): void {
    writeEditorFields(fields, snapshot.fields);
    session.restoreSnapshotState(snapshot);
    editorLayout.setPaperWidth(snapshot.paperWidth);
    previewWorkflow.renderPreviewMode({ focusWrite: false });
    mediaWorkflow.renderImages();
    mediaWorkflow.renderCover();
    sync();
  }

  function getSnapshotSignature(snapshot: EditorSnapshot) {
    return getEditorSnapshotSignature(snapshot);
  }

  function handleSheetEdgePointerMove(event: PointerEvent): void {
    const sheetRect = paper.getBoundingClientRect();
    paperResize.updateVisibility(event, sheetRect);
    editorLayout.handleSheetEdgePointerMove(event, sheetRect);
  }

  function buildMarkdown(documentRecord = getCurrentDocumentForExport()): string {
    return buildDocumentMarkdown({ documentRecord });
  }

  function getCurrentDocumentForExport(): DocumentRecord {
    return updateActiveDocumentFromEditor({ touch: false }) || getActiveDocument() || createDefaultDocument();
  }

  function getDocumentForExportById(documentId: string): DocumentRecord | null {
    updateActiveDocumentFromEditor({ touch: false });
    return session.documents.find((documentRecord) => documentRecord.id === documentId) || null;
  }

  function getSelectedDocuments(): DocumentRecord[] {
    return session.documents.filter((documentRecord) => session.selectedDocumentIds.has(documentRecord.id));
  }

  function getPrimaryDocumentsForExport(): DocumentRecord[] {
    updateActiveDocumentFromEditor({ touch: false });
    const selectedDocuments = getSelectedDocuments();
    return selectedDocuments.length ? selectedDocuments : [getCurrentDocumentForExport()];
  }

  function handlePreviewImagePaste(event: ClipboardEvent): void {
    if (!session.isPreviewActive() || isEditableTarget(event.target)) return;

    const frame = previewImageEditor.getSelectedFrame();
    if (!frame) return;

    const [file] = getClipboardImages(event.clipboardData);
    if (!file) return;

    event.preventDefault();
    previewImageEditor.replaceImage(frame, file);
  }

  function handlePreviewPointerDown(event: PointerEvent): void {
    const target = getElement(event.target);
    if (target?.closest('.preview-image-frame')) return;
    previewImageEditor.clearSelection();
  }

  function getFieldValue(name: EditorFieldName): string {
    return fields.get(name)?.value.trim() || '';
  }

  function setFieldValue(name: EditorFieldName, value: string): void {
    const field = fields.get(name);
    if (field) {
      field.value = value;
    }
  }

}

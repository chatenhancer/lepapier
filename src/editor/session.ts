import {
  createDefaultDocument as createDefaultWorkspaceDocument,
  normalizeDocumentRecord as normalizeWorkspaceDocumentRecord,
  type NormalizeDocumentOptions
} from '../app/workspace-state';
import { findLiveAsset } from '../media/media-library';
import type {
  AssetMetadata,
  DocumentEditState,
  DocumentRecord,
  EditableFileState,
  EditableFolderState,
  MediaAsset,
  WorkspaceDraft
} from '../shared/types';

export interface EditorSessionOptions {
  createDocumentId(): string;
  defaultPaperWidth: number;
  getPaperWidth(): number;
  maximumPaperWidth: number;
  minimumPaperWidth: number;
}

export interface EditorSession {
  readonly documents: DocumentRecord[];
  readonly editableFiles: Map<string, EditableFileState>;
  readonly editableFolders: Map<string, EditableFolderState>;
  readonly selectedDocumentIds: Set<string>;
  readonly selectedMedia: MediaAsset[];
  addDocument(documentRecord: DocumentRecord): void;
  createDefaultDocument(overrides?: Partial<DocumentRecord>): DocumentRecord;
  getActiveDocument(): DocumentRecord | null;
  getActiveDocumentId(): string;
  getCoverImage(): MediaAsset | null;
  getEditState(): DocumentEditState;
  getLiveAsset(metadata: AssetMetadata | null | undefined): MediaAsset | null;
  isPreviewActive(): boolean;
  loadDraft(draft: WorkspaceDraft): void;
  markFieldEdited(fieldName: string): void;
  normalizeDocumentRecord(documentRecord: unknown): DocumentRecord | null;
  replaceDocuments(documentRecords: DocumentRecord[], activeDocumentId: string): void;
  replaceSelectedMedia(media: MediaAsset[]): void;
  resetEditState(): void;
  resetWorkspace(documentRecord: DocumentRecord): void;
  restoreSnapshotState(snapshot: {
    coverImage: MediaAsset | null;
    editState: DocumentEditState;
    media: MediaAsset[];
    previewActive: boolean;
  }): void;
  setActiveDocumentId(documentId: string): void;
  setCoverImage(asset: MediaAsset | null): void;
  setDocumentEditState(editState: Partial<DocumentEditState> | null | undefined): void;
  setPreviewActive(value: boolean): void;
  togglePreviewActive(): boolean;
}

export function createEditorSession({
  createDocumentId,
  defaultPaperWidth,
  getPaperWidth,
  maximumPaperWidth,
  minimumPaperWidth
}: EditorSessionOptions): EditorSession {
  const documents: DocumentRecord[] = [];
  const editableFiles = new Map<string, EditableFileState>();
  const editableFolders = new Map<string, EditableFolderState>();
  const selectedDocumentIds = new Set<string>();
  const selectedMedia: MediaAsset[] = [];
  let activeDocumentId = '';
  let coverImage: MediaAsset | null = null;
  let editState: DocumentEditState = createEmptyEditState();
  let previewActive = false;

  const getNormalizeDocumentOptions = (): NormalizeDocumentOptions => ({
    createDocumentId,
    defaultPaperWidth,
    maximumPaperWidth,
    minimumPaperWidth
  });

  const setDocumentEditState = (nextEditState: Partial<DocumentEditState> | null | undefined) => {
    editState = {
      description: Boolean(nextEditState?.description),
      slug: Boolean(nextEditState?.slug),
      tags: Boolean(nextEditState?.tags),
      title: Boolean(nextEditState?.title)
    };
  };

  const getActiveDocument = () => {
    return documents.find((documentRecord) => documentRecord.id === activeDocumentId) || documents[0] || null;
  };

  const getLiveAsset = (metadata: AssetMetadata | null | undefined) => {
    return findLiveAsset(metadata, [coverImage, ...selectedMedia]);
  };

  const resetEditState = () => {
    editState = createEmptyEditState();
  };

  return {
    documents,
    editableFiles,
    editableFolders,
    selectedDocumentIds,
    selectedMedia,
    addDocument(documentRecord) {
      documents.push(documentRecord);
      activeDocumentId = documentRecord.id;
    },
    createDefaultDocument(overrides = {}) {
      return createDefaultWorkspaceDocument({
        paperWidth: getPaperWidth(),
        viewMode: previewActive ? 'preview' : 'write',
        ...overrides
      }, {
        createDocumentId,
        paperWidth: getPaperWidth()
      });
    },
    getActiveDocument,
    getActiveDocumentId() {
      return activeDocumentId;
    },
    getCoverImage() {
      return coverImage;
    },
    getEditState() {
      return { ...editState };
    },
    getLiveAsset,
    isPreviewActive() {
      return previewActive;
    },
    loadDraft(draft) {
      documents.splice(0, documents.length, ...draft.documents);
      activeDocumentId = draft.activeDocumentId;
      selectedDocumentIds.clear();
    },
    markFieldEdited(fieldName) {
      if (fieldName === 'title') editState.title = true;
      if (fieldName === 'slug') editState.slug = true;
      if (fieldName === 'description') editState.description = true;
      if (fieldName === 'tags') editState.tags = true;
    },
    normalizeDocumentRecord(documentRecord) {
      return normalizeWorkspaceDocumentRecord(documentRecord, getNormalizeDocumentOptions());
    },
    replaceDocuments(documentRecords, nextActiveDocumentId) {
      documents.splice(0, documents.length, ...documentRecords);
      activeDocumentId = nextActiveDocumentId;
      for (const documentId of selectedDocumentIds) {
        if (!documents.some((documentRecord) => documentRecord.id === documentId)) {
          selectedDocumentIds.delete(documentId);
        }
      }
    },
    replaceSelectedMedia(media) {
      selectedMedia.splice(0, selectedMedia.length, ...media);
    },
    resetEditState,
    resetWorkspace(documentRecord) {
      editableFiles.clear();
      editableFolders.clear();
      selectedDocumentIds.clear();
      documents.splice(0, documents.length, documentRecord);
      activeDocumentId = documentRecord.id;
      selectedMedia.splice(0, selectedMedia.length);
      coverImage = null;
      resetEditState();
      previewActive = false;
    },
    restoreSnapshotState(snapshot) {
      coverImage = snapshot.coverImage || null;
      selectedMedia.splice(0, selectedMedia.length, ...(snapshot.media || []));
      setDocumentEditState(snapshot.editState);
      previewActive = Boolean(snapshot.previewActive);
    },
    setActiveDocumentId(documentId) {
      activeDocumentId = documentId;
    },
    setCoverImage(asset) {
      coverImage = asset;
    },
    setDocumentEditState,
    setPreviewActive(value) {
      previewActive = value;
    },
    togglePreviewActive() {
      previewActive = !previewActive;
      return previewActive;
    }
  };
}

function createEmptyEditState(): DocumentEditState {
  return {
    description: false,
    slug: false,
    tags: false,
    title: false
  };
}

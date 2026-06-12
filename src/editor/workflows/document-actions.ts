import { reduceEditorState } from '../../app/editor-state';
import {
  getDocumentTitle
} from '../../documents/document-list-view';
import type { DocumentRecord, EditableFileState, EditableFolderState } from '../../shared/types';

export interface EditorDocumentActions {
  addDocument(): void;
  deleteDocument(documentId: string): void;
  deleteDocuments(documentIds: string[]): void;
  renderDocumentsList(): void;
  switchDocument(documentId: string): void;
}

export interface EditorDocumentActionsOptions {
  applyDocumentToEditor(documentRecord: DocumentRecord | null, options?: { focusWrite?: boolean; restoreCover?: boolean }): void;
  createDefaultDocument(overrides?: Partial<DocumentRecord>): DocumentRecord;
  deleteEditableFolderHandle(documentId: string): Promise<void>;
  documents: DocumentRecord[];
  editableFiles: Map<string, EditableFileState>;
  editableFolders: Map<string, EditableFolderState>;
  getActiveDocument(): DocumentRecord | null;
  getActiveDocumentId(): string;
  getCurrentPaperWidth(): number;
  getCurrentViewMode(): DocumentRecord['viewMode'];
  renderDocumentsList(): void;
  resetHistory(): void;
  saveDraft(options?: { feedback?: boolean; touch?: boolean }): void;
  selectedDocumentIds: Set<string>;
  setActiveDocumentId(documentId: string): void;
  sync(options?: { persist?: boolean }): void;
}

export function createEditorDocumentActions({
  applyDocumentToEditor,
  createDefaultDocument,
  deleteEditableFolderHandle,
  documents,
  editableFiles,
  editableFolders,
  getActiveDocument,
  getActiveDocumentId,
  getCurrentPaperWidth,
  getCurrentViewMode,
  renderDocumentsList,
  resetHistory,
  saveDraft,
  selectedDocumentIds,
  setActiveDocumentId,
  sync
}: EditorDocumentActionsOptions): EditorDocumentActions {
  const applyDocumentState = (nextState: { activeDocumentId: string; documents: DocumentRecord[] }) => {
    documents.splice(0, documents.length, ...nextState.documents);
    setActiveDocumentId(nextState.activeDocumentId);
  };

  const addDocument = () => {
    saveDraft();
    const currentDocument = getActiveDocument();
    const nextDocument = createDefaultDocument({
      paperWidth: currentDocument?.paperWidth || getCurrentPaperWidth(),
      viewMode: currentDocument?.viewMode || getCurrentViewMode()
    });
    applyDocumentState(reduceEditorState({ activeDocumentId: getActiveDocumentId(), documents }, {
      document: nextDocument,
      type: 'add-document'
    }));
    resetHistory();
    applyDocumentToEditor(nextDocument);
    sync();
  };

  const switchDocument = (documentId: string) => {
    if (!documentId || documentId === getActiveDocumentId()) return;

    const nextDocument = documents.find((documentRecord) => documentRecord.id === documentId);
    if (!nextDocument) return;

    saveDraft({ touch: false });
    applyDocumentState(reduceEditorState({ activeDocumentId: getActiveDocumentId(), documents }, {
      documentId: nextDocument.id,
      type: 'switch-document'
    }));
    resetHistory();
    applyDocumentToEditor(nextDocument);
    sync({ persist: false });
    saveDraft({ touch: false });
  };

  const deleteDocumentRecords = (documentIds: string[], confirmationMessage: string): void => {
    const ids = new Set(documentIds.filter((documentId) => documents.some((documentRecord) => documentRecord.id === documentId)));
    if (!ids.size) return;
    if (!window.confirm(confirmationMessage)) return;

    const activeDocumentId = getActiveDocumentId();
    const firstDeletedIndex = documents.findIndex((documentRecord) => ids.has(documentRecord.id));
    const nextDocuments = documents.filter((documentRecord) => !ids.has(documentRecord.id));
    const nextActiveDocumentId = nextDocuments.some((documentRecord) => documentRecord.id === activeDocumentId)
      ? activeDocumentId
      : nextDocuments[Math.min(firstDeletedIndex, nextDocuments.length - 1)]?.id || '';

    for (const documentId of ids) {
      selectedDocumentIds.delete(documentId);
      editableFiles.delete(documentId);
      editableFolders.delete(documentId);
      void deleteEditableFolderHandle(documentId);
    }

    if (!nextDocuments.length) {
      const nextDocument = createDefaultDocument();
      applyDocumentState({
        activeDocumentId: nextDocument.id,
        documents: [nextDocument]
      });
      resetHistory();
      applyDocumentToEditor(nextDocument, { focusWrite: false });
      sync();
      return;
    }

    applyDocumentState({
      activeDocumentId: nextActiveDocumentId,
      documents: nextDocuments
    });

    if (ids.has(activeDocumentId)) {
      resetHistory();
      applyDocumentToEditor(getActiveDocument(), { focusWrite: false });
    } else {
      renderDocumentsList();
    }

    sync();
  };

  const deleteDocument = (documentId: string) => {
    if (!documentId) return;

    const documentRecord = documents.find((candidate) => candidate.id === documentId);
    if (!documentRecord) return;

    deleteDocumentRecords([documentId], `Remove "${getDocumentTitle(documentRecord)}" from this workspace?`);
  };

  const deleteDocuments = (documentIds: string[]) => {
    const selectedCount = new Set(documentIds.filter((documentId) => documents.some((documentRecord) => documentRecord.id === documentId))).size;
    if (!selectedCount) return;

    deleteDocumentRecords(
      documentIds,
      `Remove ${selectedCount} selected document${selectedCount === 1 ? '' : 's'} from this workspace?\n\nSource files will not be changed.`
    );
  };

  return {
    addDocument,
    deleteDocument,
    deleteDocuments,
    renderDocumentsList,
    switchDocument
  };
}

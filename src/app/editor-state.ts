import type { DocumentRecord } from '../shared/types';

export interface EditorState {
  activeDocumentId: string;
  documents: DocumentRecord[];
}

export type EditorAction =
  | { document: DocumentRecord; type: 'add-document' }
  | { documentId: string; type: 'delete-document' }
  | { documentId: string; type: 'switch-document' }
  | { documents: DocumentRecord[]; activeDocumentId: string; type: 'replace-documents' };

export function reduceEditorState(state: EditorState, action: EditorAction): EditorState {
  if (action.type === 'add-document') {
    return {
      activeDocumentId: action.document.id,
      documents: [...state.documents, action.document]
    };
  }

  if (action.type === 'delete-document') {
    const documents = state.documents.filter((documentRecord) => documentRecord.id !== action.documentId);
    return {
      activeDocumentId: state.activeDocumentId === action.documentId ? documents[0]?.id || '' : state.activeDocumentId,
      documents
    };
  }

  if (action.type === 'switch-document') {
    return {
      ...state,
      activeDocumentId: action.documentId
    };
  }

  return {
    activeDocumentId: action.activeDocumentId,
    documents: action.documents
  };
}

import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import type { DocumentRecord } from '../../shared/types';
import { createEditorDocumentActions } from './document-actions';

describe('editor document actions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('bulk deletes selected documents after one confirmation', () => {
    const documents = [createDocument('first'), createDocument('second'), createDocument('third')];
    const selectedDocumentIds = new Set(['first', 'third']);
    let activeDocumentId = 'second';
    const deleteEditableFolderHandle = vi.fn();
    const renderDocumentsList = vi.fn();
    const sync = vi.fn();
    const confirm = vi.fn((message: string) => {
      return Boolean(message);
    });
    vi.stubGlobal('window', { confirm });

    const actions = createEditorDocumentActions({
      applyDocumentToEditor: vi.fn(),
      createDefaultDocument: () => createDocument('fallback'),
      deleteEditableFolderHandle,
      documents,
      editableFiles: new Map([['third', { connected: true, fileHandle: {} as FileSystemFileHandle }]]),
      editableFolders: new Map([['first', { connected: true, directoryHandle: {} as FileSystemDirectoryHandle }]]),
      getActiveDocument: () => documents.find((documentRecord) => documentRecord.id === activeDocumentId) || null,
      getActiveDocumentId: () => activeDocumentId,
      getCurrentPaperWidth: () => 800,
      getCurrentViewMode: () => 'write',
      renderDocumentsList,
      resetHistory: vi.fn(),
      saveDraft: vi.fn(),
      selectedDocumentIds,
      setActiveDocumentId(documentId) {
        activeDocumentId = documentId;
      },
      sync
    });

    actions.deleteDocuments(['first', 'third']);

    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm.mock.calls[0][0]).toContain('Delete 2 selected documents');
    expect(documents.map((documentRecord) => documentRecord.id)).toEqual(['second']);
    expect(activeDocumentId).toBe('second');
    expect(selectedDocumentIds.size).toBe(0);
    expect(deleteEditableFolderHandle).toHaveBeenCalledWith('first');
    expect(deleteEditableFolderHandle).toHaveBeenCalledWith('third');
    expect(renderDocumentsList).toHaveBeenCalledOnce();
    expect(sync).toHaveBeenCalledOnce();
  });
});

function createDocument(id: string): DocumentRecord {
  return {
    coverImage: null,
    editState: {
      description: false,
      slug: false,
      tags: false,
      title: false
    },
    fields: {
      body: '',
      date: '2026-06-11',
      description: '',
      image: '',
      slug: id,
      tags: '',
      title: id
    },
    frontmatterExtras: [],
    id,
    paperWidth: 800,
    source: {
      mode: 'browser'
    },
    updatedAt: 0,
    viewMode: 'write'
  };
}

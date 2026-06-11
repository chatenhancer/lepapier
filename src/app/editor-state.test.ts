import { describe, expect, it } from 'vitest';

import type { DocumentRecord } from '../shared/types';
import { reduceEditorState } from './editor-state';

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
      date: '',
      description: '',
      image: '',
      slug: '',
      tags: '',
      title: id
    },
    frontmatterExtras: [],
    id,
    paperWidth: 680,
    updatedAt: 0,
    viewMode: 'write'
  };
}

describe('reduceEditorState', () => {
  it('adds a document and makes it active', () => {
    const first = createDocument('first');
    const second = createDocument('second');
    const state = { activeDocumentId: 'first', documents: [first] };

    expect(reduceEditorState(state, { document: second, type: 'add-document' })).toEqual({
      activeDocumentId: 'second',
      documents: [first, second]
    });
    expect(state.documents).toEqual([first]);
  });

  it('switches active documents', () => {
    expect(reduceEditorState({
      activeDocumentId: 'first',
      documents: [createDocument('first'), createDocument('second')]
    }, {
      documentId: 'second',
      type: 'switch-document'
    }).activeDocumentId).toBe('second');
  });

  it('deletes active and inactive documents', () => {
    const first = createDocument('first');
    const second = createDocument('second');
    const third = createDocument('third');

    expect(reduceEditorState({
      activeDocumentId: 'second',
      documents: [first, second, third]
    }, {
      documentId: 'first',
      type: 'delete-document'
    })).toEqual({
      activeDocumentId: 'second',
      documents: [second, third]
    });

    expect(reduceEditorState({
      activeDocumentId: 'second',
      documents: [first, second, third]
    }, {
      documentId: 'second',
      type: 'delete-document'
    })).toEqual({
      activeDocumentId: 'first',
      documents: [first, third]
    });
  });

  it('replaces the document collection', () => {
    const replacement = [createDocument('replacement')];
    expect(reduceEditorState({
      activeDocumentId: 'old',
      documents: [createDocument('old')]
    }, {
      activeDocumentId: 'replacement',
      documents: replacement,
      type: 'replace-documents'
    })).toEqual({
      activeDocumentId: 'replacement',
      documents: replacement
    });
  });
});

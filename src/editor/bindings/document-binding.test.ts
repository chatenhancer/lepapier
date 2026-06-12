import { describe, expect, it } from 'vitest';

import { updateDocumentFromEditor } from './document-binding';
import type {
  DocumentEditState,
  DocumentFields,
  DocumentRecord,
  ImageAsset
} from '../../shared/types';
import type {
  EditorFieldElement,
  EditorFieldName
} from './elements';

describe('updateDocumentFromEditor', () => {
  it('preserves unrestored cover metadata while the image field still points at it', () => {
    const documentRecord = createDocument({
      coverImage: {
        id: 'cover-id',
        name: 'hero.png',
        path: 'images/hero.png',
        sourcePath: 'posts/images/hero.png'
      },
      fields: createFields({ image: 'images/hero.png' })
    });

    updateDocumentFromEditor(documentRecord, {
      coverImage: null,
      editState: createEditState(),
      fields: createFieldElements({ image: 'images/hero.png' }),
      paperWidth: 720,
      previewActive: false,
      touch: false
    });

    expect(documentRecord.coverImage).toEqual({
      id: 'cover-id',
      name: 'hero.png',
      path: 'images/hero.png',
      sourcePath: 'posts/images/hero.png'
    });
  });

  it('clears cover metadata when the image field no longer points at it', () => {
    const documentRecord = createDocument({
      coverImage: {
        id: 'cover-id',
        name: 'hero.png',
        path: 'images/hero.png'
      },
      fields: createFields({ image: 'images/hero.png' })
    });

    updateDocumentFromEditor(documentRecord, {
      coverImage: null,
      editState: createEditState(),
      fields: createFieldElements({ image: '' }),
      paperWidth: 720,
      previewActive: false,
      touch: false
    });

    expect(documentRecord.coverImage).toBeNull();
  });

  it('uses live cover metadata when a cover image is available', () => {
    const documentRecord = createDocument({
      coverImage: {
        id: 'old-cover-id',
        name: 'old.png',
        path: 'old.png'
      },
      fields: createFields({ image: 'old.png' })
    });
    const liveCover = createImageAsset('new-cover-id', 'new.png');

    updateDocumentFromEditor(documentRecord, {
      coverImage: liveCover,
      editState: createEditState(),
      fields: createFieldElements({ image: 'new.png' }),
      paperWidth: 720,
      previewActive: false,
      touch: false
    });

    expect(documentRecord.coverImage).toEqual({
      id: 'new-cover-id',
      name: 'new.png',
      path: 'new.png',
      sourcePath: undefined
    });
  });
});

function createDocument(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return {
    coverImage: null,
    editState: createEditState(),
    fields: createFields(),
    frontmatterExtras: [],
    id: 'document-id',
    paperWidth: 680,
    updatedAt: 0,
    viewMode: 'write',
    ...overrides
  };
}

function createFields(overrides: Partial<DocumentFields> = {}): DocumentFields {
  return {
    body: '',
    date: '2026-06-12',
    description: '',
    image: '',
    slug: '',
    tags: '',
    title: 'Document',
    ...overrides
  };
}

function createFieldElements(overrides: Partial<DocumentFields> = {}): Map<EditorFieldName, EditorFieldElement> {
  const fields = createFields(overrides);
  return new Map(Object.entries(fields).map(([name, value]) => [
    name as EditorFieldName,
    { value } as EditorFieldElement
  ]));
}

function createEditState(): DocumentEditState {
  return {
    description: false,
    slug: false,
    tags: false,
    title: false
  };
}

function createImageAsset(id: string, path: string): ImageAsset {
  return {
    file: new File(['image'], path, { type: 'image/png' }),
    id,
    name: path,
    path,
    url: `blob:${id}`
  };
}

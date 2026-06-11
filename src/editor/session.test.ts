import { describe, expect, it } from 'vitest';

import { createEditorSession } from './session';
import type { DocumentRecord, ImageAsset } from '../shared/types';

describe('editor session', () => {
  it('owns document, preview, and edit state', () => {
    const session = createTestSession();
    const firstDocument = session.createDefaultDocument({ id: 'first' });

    session.addDocument(firstDocument);
    session.markFieldEdited('title');
    session.setPreviewActive(true);

    expect(session.getActiveDocumentId()).toBe('first');
    expect(session.getActiveDocument()).toBe(firstDocument);
    expect(session.getEditState()).toMatchObject({ title: true });
    expect(session.isPreviewActive()).toBe(true);
  });

  it('restores snapshot state without leaking mutable arrays', () => {
    const session = createTestSession();
    const image = createImage('hero.png');

    session.restoreSnapshotState({
      coverImage: image,
      editState: {
        description: true,
        slug: false,
        tags: false,
        title: true
      },
      images: [image],
      previewActive: true
    });

    expect(session.getCoverImage()).toBe(image);
    expect(session.selectedImages).toEqual([image]);
    expect(session.getEditState()).toEqual({
      description: true,
      slug: false,
      tags: false,
      title: true
    });
    expect(session.isPreviewActive()).toBe(true);
  });

  it('resets workspace collections around a supplied document', () => {
    const session = createTestSession();
    const nextDocument = session.createDefaultDocument({ id: 'next' });

    session.addDocument(session.createDefaultDocument({ id: 'old' }));
    session.selectedImages.push(createImage('old.png'));
    session.setPreviewActive(true);
    session.markFieldEdited('description');
    session.resetWorkspace(nextDocument);

    expect(session.documents).toEqual([nextDocument]);
    expect(session.getActiveDocumentId()).toBe('next');
    expect(session.selectedImages).toEqual([]);
    expect(session.getCoverImage()).toBeNull();
    expect(session.getEditState()).toEqual({
      description: false,
      slug: false,
      tags: false,
      title: false
    });
    expect(session.isPreviewActive()).toBe(false);
  });
});

function createTestSession() {
  return createEditorSession({
    createDocumentId: () => 'document-id',
    defaultPaperWidth: 800,
    getPaperWidth: () => 840,
    maximumPaperWidth: 920,
    minimumPaperWidth: 540
  });
}

function createImage(name: string): ImageAsset {
  return {
    file: new File(['image'], name, { type: 'image/png' }),
    id: name,
    name,
    path: name,
    url: `blob:${name}`
  };
}

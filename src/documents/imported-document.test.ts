import { describe, expect, it } from 'vitest';

import type { DocumentRecord } from '../shared/types';
import { createImportedDocument } from './imported-document';
import { createImportAssetRegistry } from './document-import';

describe('createImportedDocument', () => {
  it('creates a normalized document from markdown frontmatter', () => {
    const source = [
      '---',
      'title: Imported Note',
      'date: 2026-06-11',
      'description: Imported description',
      'slug: imported-note',
      'tags:',
      '  - writing',
      'image: ./hero.png',
      '---',
      '',
      'Body with ![Hero](./hero.png)'
    ].join('\n');
    const markdownFile = new File([source], 'index.md', { type: 'text/markdown' });
    const hero = new File(['image'], 'hero.png', { type: 'image/png' });

    const imported = createImportedDocument({
      createAssetId: () => 'asset-id',
      createDocumentId: () => 'document-id',
      existingAssetNames: [],
      files: [markdownFile, hero],
      getFilePath: (file) => file.name,
      markdownFile,
      normalizeDocumentRecord: (documentRecord) => documentRecord as DocumentRecord,
      paperWidth: 800,
      previewActive: false,
      source
    });

    expect(imported.documentRecord.id).toBe('document-id');
    expect(imported.documentRecord.fields.title).toBe('Imported Note');
    expect(imported.documentRecord.fields.slug).toBe('imported-note');
    expect(imported.documentRecord.fields.tags).toBe('writing');
    expect(imported.documentRecord.fields.body).toBe('Body with ![Hero](hero.png)');
    expect(imported.coverImage?.path).toBe('hero.png');
  });

  it('resolves nested markdown image references against the markdown file path', () => {
    const source = 'Body with ![Hero](../assets/hero.png)';
    const markdownFile = new File([source], 'note.md', { type: 'text/markdown' });
    const hero = new File(['image'], 'hero.png', { type: 'image/png' });
    const unused = new File(['unused'], 'unused.png', { type: 'image/png' });

    const imported = createImportedDocument({
      createAssetId: () => 'asset-id',
      createDocumentId: () => 'document-id',
      existingAssetNames: [],
      files: [markdownFile, hero, unused],
      getFilePath(file) {
        if (file === markdownFile) return 'posts/note.md';
        if (file === hero) return 'assets/hero.png';
        return 'assets/unused.png';
      },
      markdownFile,
      normalizeDocumentRecord: (documentRecord) => documentRecord as DocumentRecord,
      paperWidth: 800,
      previewActive: false,
      source
    });

    expect(imported.documentRecord.fields.body).toBe('Body with ![Hero](assets/hero.png)');
    expect(imported.assets.map((asset) => asset.path)).toEqual(['assets/hero.png']);
  });

  it('reuses shared image assets across a multi-document import batch', () => {
    const firstSource = 'First body with ![Hero](../assets/hero.png)';
    const secondSource = 'Second body with ![Hero](../assets/hero.png)';
    const firstMarkdown = new File([firstSource], 'first.md', { type: 'text/markdown' });
    const secondMarkdown = new File([secondSource], 'second.md', { type: 'text/markdown' });
    const hero = new File(['image'], 'hero.png', { type: 'image/png' });
    const assetRegistry = createImportAssetRegistry();
    let assetNumber = 0;

    const firstImported = createImportedDocument({
      assetRegistry,
      createAssetId: () => `asset-${++assetNumber}`,
      createDocumentId: () => 'first-document',
      existingAssetNames: [],
      files: [firstMarkdown, secondMarkdown, hero],
      getFilePath(file) {
        if (file === firstMarkdown) return 'posts/first.md';
        if (file === secondMarkdown) return 'posts/second.md';
        return 'assets/hero.png';
      },
      markdownFile: firstMarkdown,
      normalizeDocumentRecord: (documentRecord) => documentRecord as DocumentRecord,
      paperWidth: 800,
      previewActive: false,
      source: firstSource
    });

    const secondImported = createImportedDocument({
      assetRegistry,
      createAssetId: () => `asset-${++assetNumber}`,
      createDocumentId: () => 'second-document',
      existingAssetNames: [],
      files: [firstMarkdown, secondMarkdown, hero],
      getFilePath(file) {
        if (file === firstMarkdown) return 'posts/first.md';
        if (file === secondMarkdown) return 'posts/second.md';
        return 'assets/hero.png';
      },
      markdownFile: secondMarkdown,
      normalizeDocumentRecord: (documentRecord) => documentRecord as DocumentRecord,
      paperWidth: 800,
      previewActive: false,
      source: secondSource
    });

    expect(firstImported.assets.map((asset) => asset.path)).toEqual(['assets/hero.png']);
    expect(secondImported.assets).toEqual([]);
    expect(secondImported.images[0]).toBe(firstImported.images[0]);
    expect(secondImported.documentRecord.fields.body).toBe('Second body with ![Hero](assets/hero.png)');
  });
});

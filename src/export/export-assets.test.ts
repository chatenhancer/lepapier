import { describe, expect, it } from 'vitest';

import type {
  MediaAsset,
  DocumentRecord
} from '../shared/types';
import {
  collectExportAssets,
  resolveExportAsset
} from './export-assets';

describe('export asset helpers', () => {
  it('collects unique body and cover assets for documents', async () => {
    const hero = createAsset('hero.png');
    const cover = createAsset('cover.png');
    const documentRecord = createDocument({
      body: '![Hero](hero.png)\n\n![Hero again](hero.png)',
      image: 'cover.png'
    });

    const assets = await collectExportAssets([documentRecord], {
      resolveAssetForPath: async (path) => path === 'hero.png' ? hero : cover
    });

    expect(assets).toEqual([hero, cover]);
  });

  it('resolves live assets before restored cover assets', async () => {
    const live = createAsset('hero.png');
    const restored = createAsset('cover.png');

    await expect(resolveExportAsset('hero.png', createDocument(), {
      documents: [createDocument({ image: 'cover.png' })],
      getLiveAsset: () => live,
      restoreAssetFromEditableFolder: async () => null,
      restoreSavedAsset: async () => restored
    })).resolves.toBe(live);
  });

  it('falls back to editable folder restoration', async () => {
    const restored = createAsset('hero.png');

    await expect(resolveExportAsset('hero.png', createDocument(), {
      documents: [],
      getLiveAsset: () => null,
      restoreAssetFromEditableFolder: async () => restored,
      restoreSavedAsset: async () => null
    })).resolves.toBe(restored);
  });
});

function createDocument(fields: Partial<DocumentRecord['fields']> = {}): DocumentRecord {
  return {
    coverImage: fields.image ? { path: fields.image } : null,
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
      slug: 'document',
      tags: '',
      title: 'Document',
      ...fields
    },
    frontmatterExtras: [],
    id: 'document',
    paperWidth: 800,
    updatedAt: 0,
    viewMode: 'write'
  };
}

function createAsset(path: string): MediaAsset {
  return {
    file: new File(['image'], path, { type: 'image/png' }),
    id: path,
    name: path,
    path,
    url: `blob:${path}`
  };
}

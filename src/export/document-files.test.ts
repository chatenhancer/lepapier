import { describe, expect, it } from 'vitest';

import type { MediaAsset, DocumentRecord } from '../shared/types';
import {
  createEditableFolderDocumentFiles,
  createEditableFileDocumentFile,
  createDocumentCollectionZipFiles,
  createDocumentZipFilesForDocument,
  createPortableDocumentFiles
} from './document-files';

const decoder = new TextDecoder();

describe('document export file assembly', () => {
  it('creates a zip file list for one document and rewrites local asset paths', async () => {
    const asset = createAsset({ name: 'hero.png', path: 'hero.png' });
    const files = await createDocumentZipFilesForDocument({
      documentRecord: createDocument({
        body: '![Hero](hero.png)',
        image: 'hero.png',
        slug: 'hello',
        title: 'Hello'
      }),
      folderName: '2026-06-11-hello',
      resolveAssets: async () => [asset]
    });

    expect(files.map((file) => file.path)).toEqual([
      '2026-06-11-hello/index.md',
      '2026-06-11-hello/hero.png'
    ]);
    expect(decoder.decode(files[0].data)).toContain('![Hero](./hero.png)');
  });

  it('randomizes document zip media filenames from content hashes', async () => {
    const asset = createAsset({ name: 'hero.png', path: 'hero.png' });
    const files = await createDocumentZipFilesForDocument({
      documentRecord: createDocument({
        body: '![Hero](hero.png)',
        slug: 'hello',
        title: 'Hello'
      }),
      folderName: '2026-06-11-hello',
      randomizeMediaNames: true,
      readAssetData: async () => new Uint8Array([9]),
      resolveAssets: async () => [asset]
    });

    expect(files.map((file) => file.path)).toEqual([
      '2026-06-11-hello/index.md',
      '2026-06-11-hello/2b4c342f5433ebe5.png'
    ]);
    expect(decoder.decode(files[0].data)).toContain('![Hero](./2b4c342f5433ebe5.png)');
  });

  it('deduplicates collection folder names', async () => {
    const documentRecord = createDocument({ slug: 'same', title: 'Same' });
    const files = await createDocumentCollectionZipFiles({
      documentRecords: [documentRecord, { ...documentRecord, id: 'second' }],
      resolveAssets: async () => []
    });

    expect(files.map((file) => file.path)).toEqual([
      '2026-06-11-same/index.md',
      '2026-06-11-same-2/index.md'
    ]);
  });

  it('creates editable folder files using source asset paths', async () => {
    const asset = createAsset({
      name: 'hero.png',
      path: 'hero.png',
      sourcePath: 'assets/hero.png'
    });
    const files = await createEditableFolderDocumentFiles({
      documentRecord: createDocument(
        {
          body: '![Hero](hero.png)',
          image: 'hero.png'
        },
        {
          source: {
            markdownPath: 'index.md',
            mode: 'editable-folder'
          }
        }
      ),
      readAssetData: async () => new Uint8Array([9, 8, 7]),
      resolveAssets: async () => [asset]
    });

    expect(files.map((file) => file.path)).toEqual(['index.md', 'assets/hero.png']);
    expect(decoder.decode(files[0].data)).toContain('![Hero](./assets/hero.png)');
    expect(Array.from(files[1].data)).toEqual([9, 8, 7]);
  });

  it('creates editable folder files relative to nested markdown paths', async () => {
    const asset = createAsset({
      name: 'hero.png',
      path: 'assets/hero.png',
      sourcePath: 'assets/hero.png'
    });
    const files = await createEditableFolderDocumentFiles({
      documentRecord: createDocument(
        {
          body: '![Hero](assets/hero.png)'
        },
        {
          source: {
            markdownPath: 'posts/note.md',
            mode: 'editable-folder'
          }
        }
      ),
      readAssetData: async () => new Uint8Array([9]),
      resolveAssets: async () => [asset]
    });

    expect(files.map((file) => file.path)).toEqual(['posts/note.md', 'assets/hero.png']);
    expect(decoder.decode(files[0].data)).toContain('![Hero](../assets/hero.png)');
  });

  it('randomizes editable folder media filenames when requested', async () => {
    const hashPrefix = '2b4c342f5433ebe5';
    const asset = createAsset({
      name: 'hero.png',
      path: 'assets/hero.png',
      sourcePath: 'assets/hero.png'
    });
    const sameContentAsset = createAsset({
      name: 'different.png',
      path: 'different.png',
      sourcePath: 'assets/different.png'
    });
    const files = await createEditableFolderDocumentFiles({
      documentRecord: createDocument(
        {
          body: '![Hero](assets/hero.png)'
        },
        {
          source: {
            markdownPath: 'posts/note.md',
            mode: 'editable-folder'
          }
        }
      ),
      randomizeMediaNames: true,
      readAssetData: async () => new Uint8Array([9]),
      resolveAssets: async () => [asset]
    });
    const mediaFile = files.find((file) => file.path !== 'posts/note.md');
    const secondFiles = await createEditableFolderDocumentFiles({
      documentRecord: createDocument(
        {
          body: '![Hero](different.png)'
        },
        {
          source: {
            markdownPath: 'posts/note.md',
            mode: 'editable-folder'
          }
        }
      ),
      randomizeMediaNames: true,
      readAssetData: async () => new Uint8Array([9]),
      resolveAssets: async () => [sameContentAsset]
    });
    const secondMediaFile = secondFiles.find((file) => file.path !== 'posts/note.md');

    expect(mediaFile?.path).toBe(`assets/${hashPrefix}.png`);
    expect(mediaFile?.path).not.toBe('assets/hero.png');
    expect(secondMediaFile?.path).toBe(mediaFile?.path);
    expect(decoder.decode(files[0].data)).toContain(`![Hero](../assets/${hashPrefix}.png)`);
  });

  it('randomizes portable bundle media filenames from content hashes', async () => {
    const asset = createAsset({
      name: 'hero.png',
      path: 'assets/hero.png',
      sourcePath: 'source-assets/hero.png'
    });
    const files = await createPortableDocumentFiles({
      documentRecords: [createDocument(
        {
          body: '![Hero](assets/hero.png)',
          slug: 'portable',
          title: 'Portable'
        },
        {
          source: {
            markdownPath: 'posts/portable.md',
            mode: 'folder'
          }
        }
      )],
      randomizeMediaNames: true,
      readAssetData: async () => new Uint8Array([9]),
      resolveAssets: async () => [asset]
    });
    const markdownFile = files.find((file) => file.path === 'posts/portable.md');
    const mediaFile = files.find((file) => file.path !== 'posts/portable.md');

    expect(mediaFile?.path).toBe('posts/portable-assets/2b4c342f5433ebe5.png');
    expect(mediaFile?.path).not.toBe('source-assets/hero.png');
    expect(decoder.decode(markdownFile?.data || new Uint8Array())).toContain('![Hero](./portable-assets/2b4c342f5433ebe5.png)');
  });

  it('creates a portable single markdown file when there are no assets', async () => {
    const files = await createPortableDocumentFiles({
      documentRecords: [createDocument({ body: 'Body' }, {
        source: {
          markdownPath: 'note.md',
          mode: 'file'
        }
      })],
      resolveAssets: async () => []
    });

    expect(files.map((file) => file.path)).toEqual(['note.md']);
    expect(decoder.decode(files[0].data)).toContain('Body');
  });

  it('embeds assets for editable single-file documents', async () => {
    const asset = createAsset({ name: 'hero.png', path: 'hero.png' });
    const file = await createEditableFileDocumentFile({
      documentRecord: createDocument(
        {
          body: '![Hero](hero.png)'
        },
        {
          source: {
            markdownPath: 'note.md',
            mode: 'editable-file'
          }
        }
      ),
      readAssetData: async () => new Uint8Array([1, 2, 3]),
      resolveAssets: async () => [asset]
    });

    expect(file.path).toBe('note.md');
    expect(decoder.decode(file.data)).toContain('![Hero](data:image/png;base64,AQID)');
  });
});

function createDocument(
  fields: Partial<DocumentRecord['fields']> = {},
  overrides: Partial<DocumentRecord> = {}
): DocumentRecord {
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
      slug: 'untitled',
      tags: '',
      title: 'Untitled',
      ...fields
    },
    frontmatterExtras: [],
    id: fields.slug || 'document',
    paperWidth: 800,
    source: {
      mode: 'browser'
    },
    updatedAt: 0,
    viewMode: 'write',
    ...overrides
  };
}

function createAsset({
  name,
  path,
  sourcePath
}: {
  name: string;
  path: string;
  sourcePath?: string;
}): MediaAsset {
  return {
    file: new File([new Uint8Array([1, 2, 3])], name, { type: 'image/png' }),
    id: path,
    name,
    path,
    sourcePath,
    url: `blob:${path}`
  };
}

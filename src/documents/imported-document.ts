import {
  formatImportedTags,
  getImportTitleFromFile,
  parseImportedMarkdown
} from '../markdown/frontmatter';
import {
  createDocumentImportPlan,
  type ImportedAssetRegistry,
  normalizeImportedAssetReference,
  rewriteImportedMarkdownAssetPaths
} from './document-import';
import { getToday } from '../shared/date';
import type {
  AssetMetadata,
  MediaAsset,
  DocumentSource,
  DocumentRecord
} from '../shared/types';
import { slugify } from '../shared/text';

export interface ImportedDocument {
  assets: MediaAsset[];
  coverImage: MediaAsset | null;
  documentRecord: DocumentRecord;
  media: MediaAsset[];
}

export interface CreateImportedDocumentOptions {
  assetRegistry?: ImportedAssetRegistry;
  createAssetId(): string;
  createDocumentId(): string;
  existingAssetNames: string[];
  files: File[];
  getFilePath(file: File): string;
  markdownFile: File;
  normalizeDocumentRecord(documentRecord: unknown): DocumentRecord | null;
  paperWidth: number;
  previewActive: boolean;
  sourceMetadata?: DocumentSource | null;
  source: string;
}

export function createImportedDocument({
  assetRegistry,
  createAssetId,
  createDocumentId,
  existingAssetNames,
  files,
  getFilePath,
  markdownFile,
  normalizeDocumentRecord,
  paperWidth,
  previewActive,
  sourceMetadata,
  source
}: CreateImportedDocumentOptions): ImportedDocument {
  const { body, frontmatter, frontmatterExtras } = parseImportedMarkdown(source);
  const importPlan = createDocumentImportPlan({
    assetRegistry,
    body,
    createAssetId,
    existingAssetNames,
    files,
    frontmatter,
    getFilePath,
    markdownFile
  });
  const title = getFrontmatterValue(frontmatter.title).trim() || getImportTitleFromFile(markdownFile);
  const slug = getFrontmatterValue(frontmatter.slug).trim() || slugify(title);
  const importedBody = rewriteImportedMarkdownAssetPaths(body.trim(), importPlan.assetPathMap);
  const importedCoverImagePath = importPlan.coverImage?.path || normalizeImportedAssetReference(getFrontmatterValue(frontmatter.image));
  const documentRecord = normalizeDocumentRecord({
    coverImage: serializeAssetMetadata(importPlan.coverImage),
    editState: {
      description: true,
      slug: true,
      tags: true,
      title: true
    },
    fields: {
      body: importedBody,
      date: getFrontmatterValue(frontmatter.date).trim() || getToday(),
      description: getFrontmatterValue(frontmatter.description),
      image: importedCoverImagePath,
      slug,
      tags: formatImportedTags(frontmatter.tags),
      title
    },
    frontmatterExtras,
    id: createDocumentId(),
    paperWidth,
    source: sourceMetadata || {
      markdownPath: getFilePath(markdownFile) || markdownFile.name,
      mode: 'file'
    },
    updatedAt: Date.now(),
    viewMode: previewActive ? 'preview' : 'write'
  });
  if (!documentRecord) {
    throw new Error('Imported document could not be normalized.');
  }

  return {
    assets: importPlan.assets,
    coverImage: importPlan.coverImage,
    documentRecord,
    media: importPlan.media
  };
}

function serializeAssetMetadata(asset: MediaAsset | null | undefined): AssetMetadata | null {
  if (!asset) return null;
  return {
    id: asset.id,
    name: asset.name,
    path: asset.path,
    sourcePath: asset.sourcePath
  };
}

function getFrontmatterValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value.join(', ') : String(value || '');
}

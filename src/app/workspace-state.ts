import type {
  AssetMetadata,
  DocumentRecord,
  DocumentFields,
  DocumentSource,
  WorkspaceDraft
} from '../shared/types';
import { getToday } from '../shared/date';
import { stripMarkdown } from '../shared/text';

export const currentWorkspaceDraftVersion = 3;

export interface WorkspacePreferences {
  randomizeMediaNames: boolean;
  smartPunctuation: boolean;
}

export interface WorkspaceState {
  activeDocumentId: string;
  documents: DocumentRecord[];
  media: AssetMetadata[];
  preferences: WorkspacePreferences;
  version: number;
}

export interface CreateDocumentOptions {
  createDocumentId?: () => string;
  paperWidth?: number;
}

export interface NormalizeDocumentOptions {
  createDocumentId?: () => string;
  defaultPaperWidth: number;
  maximumPaperWidth: number;
  minimumPaperWidth: number;
}

export const defaultDocumentBody = [
  'Start with the change or story that matters.',
  '',
  '## What changed',
  '',
  '- Add the important details here.',
  '',
  '## Why it matters',
  '',
  'Explain what users can do now.'
].join('\n');

export function hasUserWrittenDocumentBody(body: string): boolean {
  const normalizedBody = normalizeDocumentBodyContent(body);
  return Boolean(normalizedBody) && normalizedBody !== normalizeDocumentBodyContent(defaultDocumentBody);
}

export function createDefaultDocument(
  overrides: Partial<DocumentRecord> = {},
  {
    createDocumentId = createDocumentIdFallback,
  paperWidth = 800
  }: CreateDocumentOptions = {}
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
      body: defaultDocumentBody,
      date: getToday(),
      description: '',
      image: '',
      slug: '',
      tags: '',
      title: ''
    },
    frontmatterExtras: [],
    id: createDocumentId(),
    paperWidth,
    source: {
      mode: 'browser'
    },
    updatedAt: Date.now(),
    viewMode: 'write',
    ...overrides
  };
}

function normalizeDocumentBodyContent(body: string): string {
  return stripMarkdown(body).replace(/\s+/g, ' ').trim();
}

export function normalizeWorkspaceDraft(
  saved: unknown,
  fallbackDocument: DocumentRecord,
  options: NormalizeDocumentOptions
): WorkspaceDraft {
  const migrated = migrateWorkspaceDraft(saved);
  if (Array.isArray(migrated?.documents) && migrated.documents.length) {
    const normalizedDocuments = migrated.documents
      .map((documentRecord) => normalizeDocumentRecord(documentRecord, options))
      .filter((documentRecord): documentRecord is DocumentRecord => Boolean(documentRecord));

    if (normalizedDocuments.length) {
      const activeId = normalizedDocuments.some((documentRecord) => documentRecord.id === migrated.activeDocumentId)
        ? String(migrated.activeDocumentId)
        : normalizedDocuments[0].id;

      return {
        activeDocumentId: activeId,
        documents: normalizedDocuments,
        media: normalizeAssetMetadataList(migrated.media),
        randomizeMediaNames: Boolean(migrated.randomizeMediaNames),
        smartPunctuation: migrated.smartPunctuation !== false,
        version: currentWorkspaceDraftVersion
      };
    }
  }

  return {
    activeDocumentId: fallbackDocument.id,
    documents: [fallbackDocument],
    media: [],
    randomizeMediaNames: false,
    smartPunctuation: true,
    version: currentWorkspaceDraftVersion
  };
}

export function normalizeDocumentRecord(
  documentRecord: unknown,
  options: NormalizeDocumentOptions
): DocumentRecord | null {
  if (!isRecord(documentRecord)) return null;

  const fieldsRecord = documentRecord.fields;
  if (!isRecord(fieldsRecord)) return null;

  const fieldsValue: DocumentFields = {
    body: String(fieldsRecord.body || ''),
    date: typeof fieldsRecord.date === 'string' && fieldsRecord.date ? fieldsRecord.date : getToday(),
    description: String(fieldsRecord.description || ''),
    image: String(fieldsRecord.image || ''),
    slug: String(fieldsRecord.slug || ''),
    tags: String(fieldsRecord.tags || ''),
    title: String(fieldsRecord.title || '')
  };

  return {
    coverImage: normalizeAssetMetadata(documentRecord.coverImage),
    editState: {
      description: Boolean(isRecord(documentRecord.editState) && documentRecord.editState.description),
      slug: Boolean(isRecord(documentRecord.editState) && documentRecord.editState.slug),
      tags: Boolean(isRecord(documentRecord.editState) && documentRecord.editState.tags),
      title: Boolean(isRecord(documentRecord.editState) && documentRecord.editState.title)
    },
    fields: fieldsValue,
    frontmatterExtras: Array.isArray(documentRecord.frontmatterExtras)
      ? documentRecord.frontmatterExtras.map((line) => String(line)).filter((line) => line.trim())
      : [],
    id: typeof documentRecord.id === 'string' && documentRecord.id ? documentRecord.id : options.createDocumentId?.() || createDocumentIdFallback(),
    paperWidth: clampPaperWidth(documentRecord.paperWidth, options),
    source: normalizeDocumentSource(documentRecord.source),
    updatedAt: Number.isFinite(Number(documentRecord.updatedAt)) ? Number(documentRecord.updatedAt) : Date.now(),
    viewMode: documentRecord.viewMode === 'preview' ? 'preview' : 'write'
  };
}

export function toWorkspaceDraft(state: WorkspaceState): WorkspaceDraft {
  return {
    activeDocumentId: state.activeDocumentId,
    documents: state.documents,
    media: state.media,
    randomizeMediaNames: state.preferences.randomizeMediaNames,
    smartPunctuation: state.preferences.smartPunctuation,
    version: currentWorkspaceDraftVersion
  };
}

function migrateWorkspaceDraft(saved: unknown): Partial<WorkspaceDraft> | null {
  if (!isRecord(saved)) return null;

  if (Array.isArray(saved.documents)) {
    return saved as Partial<WorkspaceDraft>;
  }

  return null;
}

function normalizeAssetMetadataList(value: unknown): AssetMetadata[] {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeAssetMetadata).filter((asset): asset is AssetMetadata => Boolean(asset));
}

function normalizeAssetMetadata(value: unknown): AssetMetadata | null {
  if (!isRecord(value)) return null;
  return {
    id: typeof value.id === 'string' ? value.id : undefined,
    name: typeof value.name === 'string' ? value.name : undefined,
    path: typeof value.path === 'string' ? value.path : undefined,
    sourcePath: typeof value.sourcePath === 'string' ? value.sourcePath : undefined
  };
}

function normalizeDocumentSource(value: unknown): DocumentSource {
  if (!isRecord(value)) {
    return {
      mode: 'browser'
    };
  }

  const mode = normalizeDocumentSourceMode(value.mode);
  const markdownPath = typeof value.markdownPath === 'string' ? value.markdownPath.trim() : '';
  return {
    ...(markdownPath ? { markdownPath } : {}),
    mode
  };
}

function normalizeDocumentSourceMode(value: unknown): DocumentSource['mode'] {
  if (
    value === 'browser'
    || value === 'file'
    || value === 'folder'
    || value === 'editable-file'
    || value === 'editable-folder'
  ) {
    return value;
  }

  return 'browser';
}

function clampPaperWidth(value: unknown, options: NormalizeDocumentOptions): number {
  const numericValue = Number(value);
  const fallback = options.defaultPaperWidth;
  return Math.min(
    options.maximumPaperWidth,
    Math.max(options.minimumPaperWidth, Number.isFinite(numericValue) ? numericValue : fallback)
  );
}

function createDocumentIdFallback(): string {
  if ('randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `document-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

import type {
  AssetMetadata,
  MediaAsset,
  DocumentRecord,
  DocumentEditState,
  DocumentFields
} from '../../shared/types';
import type {
  EditorFieldElement,
  EditorFieldName
} from './elements';
import {
  assetMatchesPath,
  serializeAssetMetadata
} from '../../media/media-library';

export interface EditorSnapshot {
  coverImage: MediaAsset | null;
  editState: DocumentEditState;
  fields: DocumentFields;
  media: MediaAsset[];
  paperWidth: number;
  previewActive: boolean;
}

export interface CreateEditorSnapshotOptions {
  coverImage: MediaAsset | null;
  editState: DocumentEditState;
  fields: Map<EditorFieldName, EditorFieldElement>;
  media: MediaAsset[];
  paperWidth: number;
  previewActive: boolean;
}

export interface UpdateDocumentFromEditorOptions {
  coverImage: MediaAsset | null;
  editState: DocumentEditState;
  fields: Map<EditorFieldName, EditorFieldElement>;
  paperWidth: number;
  previewActive: boolean;
  touch: boolean;
}

export function createEditorSnapshot({
  coverImage,
  editState,
  fields,
  media,
  paperWidth,
  previewActive
}: CreateEditorSnapshotOptions): EditorSnapshot {
  return {
    coverImage,
    editState,
    fields: readEditorFields(fields),
    media: [...media],
    paperWidth,
    previewActive
  };
}

export function getEditorSnapshotSignature(snapshot: EditorSnapshot) {
  return {
    coverImage: getAssetSignature(snapshot.coverImage),
    editState: snapshot.editState,
    fields: snapshot.fields,
    media: (snapshot.media || []).map(getAssetSignature),
    paperWidth: snapshot.paperWidth,
    previewActive: snapshot.previewActive
  };
}

export function readEditorFields(fields: Map<EditorFieldName, EditorFieldElement>): DocumentFields {
  const values = {} as DocumentFields;
  for (const [name, field] of fields) {
    values[name] = field.value;
  }
  return values;
}

export function updateDocumentFromEditor(
  documentRecord: DocumentRecord,
  {
    coverImage,
    editState,
    fields,
    paperWidth,
    previewActive,
    touch
  }: UpdateDocumentFromEditorOptions
): DocumentRecord {
  const fieldsValue = readEditorFields(fields);
  documentRecord.coverImage = getNextCoverImageMetadata(documentRecord.coverImage, coverImage, fieldsValue.image);
  documentRecord.editState = editState;
  documentRecord.fields = fieldsValue;
  documentRecord.paperWidth = paperWidth;
  documentRecord.viewMode = previewActive ? 'preview' : 'write';
  if (touch) {
    documentRecord.updatedAt = Date.now();
  }
  return documentRecord;
}

function getNextCoverImageMetadata(
  existingCoverImage: AssetMetadata | null,
  coverImage: MediaAsset | null,
  imageFieldValue: string
): AssetMetadata | null {
  const nextCoverImage = serializeAssetMetadata(coverImage);
  if (nextCoverImage) return nextCoverImage;
  if (existingCoverImage && assetMatchesPath(existingCoverImage, imageFieldValue)) return existingCoverImage;
  return null;
}

export function writeEditorFields(
  fields: Map<EditorFieldName, EditorFieldElement>,
  values: Partial<DocumentFields> | null | undefined
): void {
  for (const [name, field] of fields) {
    field.value = values?.[name] || '';
  }
}

function getAssetSignature(asset: AssetMetadata | MediaAsset | null | undefined) {
  if (!asset) return null;
  return {
    id: asset.id,
    name: asset.name,
    path: asset.path
  };
}

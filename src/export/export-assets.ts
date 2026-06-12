import { assetMatchesPath } from '../media/media-library';
import {
  getDocumentFieldValue,
  getReferencedBodyAssetPaths,
  isImportableAssetReference,
  normalizeDocumentAssetPath
} from '../documents/document-markdown';
import type {
  MediaAsset,
  DocumentRecord
} from '../shared/types';

export interface CollectExportAssetsOptions {
  resolveAssetForPath(path: string, documentRecord: DocumentRecord): Promise<MediaAsset | null>;
}

export interface ResolveExportAssetOptions {
  documents: DocumentRecord[];
  getLiveAsset(path: string): MediaAsset | null;
  restoreAssetFromEditableFolder(path: string, documentRecord: DocumentRecord): Promise<MediaAsset | null>;
  restoreSavedAsset(metadata: DocumentRecord['coverImage']): Promise<MediaAsset | null>;
}

export interface ReadEditableFolderAssetOptions {
  isMediaFile(file: File): boolean;
  logError(message: string, error: unknown, details: Record<string, unknown>): void;
  readFile(path: string): Promise<File>;
}

export interface WriteEditableFolderFileOptions {
  logError(message: string, error: unknown, details: Record<string, unknown>): void;
  writeFile(path: string, data: Uint8Array<ArrayBuffer>): Promise<void>;
}

export async function collectExportAssets(
  documentRecords: DocumentRecord[],
  { resolveAssetForPath }: CollectExportAssetsOptions
): Promise<MediaAsset[]> {
  const assets: MediaAsset[] = [];
  const seenPaths = new Set<string>();

  for (const documentRecord of documentRecords) {
    const requestedAssetPaths = getReferencedBodyAssetPaths(documentRecord);
    const mediaPath = getDocumentFieldValue(documentRecord, 'image');
    if (isImportableAssetReference(mediaPath)) {
      requestedAssetPaths.add(mediaPath);
    }

    for (const assetPath of requestedAssetPaths) {
      const asset = await resolveAssetForPath(assetPath, documentRecord);
      if (!asset) continue;
      if (seenPaths.has(asset.path)) continue;
      seenPaths.add(asset.path);
      assets.push(asset);
    }
  }

  return assets;
}

export async function resolveExportAsset(
  path: string,
  documentRecord: DocumentRecord,
  {
    documents,
    getLiveAsset,
    restoreAssetFromEditableFolder,
    restoreSavedAsset
  }: ResolveExportAssetOptions
): Promise<MediaAsset | null> {
  const liveAsset = getLiveAsset(path);
  if (liveAsset) return liveAsset;

  const coverMetadata = documents
    .map((candidate) => candidate.coverImage)
    .find((metadata) => assetMatchesPath(metadata, path));
  if (coverMetadata) {
    const restoredAsset = await restoreSavedAsset(coverMetadata);
    if (restoredAsset) return restoredAsset;
  }

  return await restoreAssetFromEditableFolder(path, documentRecord);
}

export async function readEditableFolderAsset(
  asset: MediaAsset,
  directoryHandle: FileSystemDirectoryHandle | undefined,
  {
    isMediaFile,
    logError,
    readFile
  }: ReadEditableFolderAssetOptions
): Promise<Uint8Array<ArrayBuffer>> {
  const sourcePath = normalizeDocumentAssetPath(asset.sourcePath);
  if (directoryHandle && sourcePath) {
    try {
      const sourceFile = await readFile(sourcePath);
      if (!isMediaFile(sourceFile)) {
        throw new Error(`Editable folder asset is not supported media: ${sourcePath}`);
      }
      return new Uint8Array(await sourceFile.arrayBuffer());
    } catch (error) {
      logError('Could not read a document asset from its exact editable folder path.', error, {
        name: asset.name,
        outputPath: asset.path,
        sourcePath
      });
      throw error;
    }
  }

  try {
    return new Uint8Array(await asset.file.arrayBuffer());
  } catch (error) {
    logError('Could not read a document asset before saving to the editable folder.', error, {
      name: asset.name,
      path: asset.path,
      sourcePath: asset.sourcePath
    });
    throw error;
  }
}

export async function writeEditableFolderFile(
  path: string,
  data: Uint8Array<ArrayBuffer>,
  {
    logError,
    writeFile
  }: WriteEditableFolderFileOptions
): Promise<void> {
  try {
    await writeFile(normalizeDocumentAssetPath(path), data);
  } catch (error) {
    logError('Could not write data to an editable folder file.', error, { path });
    throw error;
  }
}

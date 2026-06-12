import {
  serializeAssetMetadata
} from '../../media/media-library';
import {
  collectExportAssets,
  resolveExportAsset
} from '../../export/export-assets';
import {
  getDocumentFieldValue,
  normalizeDocumentAssetPath
} from '../../documents/document-markdown';
import {
  normalizeImportedAssetReference
} from '../../documents/document-import';
import {
  dedupeFileName,
  sanitizeFileName
} from '../../shared/text';
import type {
  MediaAsset,
  DocumentRecord,
  EditableFolderState
} from '../../shared/types';

export interface EditorExportAssetWorkflow {
  getUniqueAssetFiles(documentRecords: DocumentRecord[]): Promise<MediaAsset[]>;
}

export interface EditorExportAssetWorkflowOptions {
  createAssetId(): string;
  documents: DocumentRecord[];
  editableFolders: Map<string, EditableFolderState>;
  getActiveDocumentId(): string;
  getCurrentAssetNames(): string[];
  getFileSourcePath(file: File): string;
  getLiveAsset(metadata: { path?: string; sourcePath?: string } | null | undefined): MediaAsset | null;
  isMediaFile(file: File): boolean;
  logError(message: string, error: unknown, details?: Record<string, unknown>): void;
  readEditableFolderFile(directoryHandle: FileSystemDirectoryHandle, path: string): Promise<File>;
  renderCover(): void;
  renderMedia(): void;
  restoreSavedAsset(metadata: DocumentRecord['coverImage']): Promise<MediaAsset | null>;
  saveAsset(asset: MediaAsset): Promise<void>;
  selectedMedia: MediaAsset[];
  setCoverImage(asset: MediaAsset): void;
}

export function createEditorExportAssetWorkflow({
  createAssetId,
  documents,
  editableFolders,
  getActiveDocumentId,
  getCurrentAssetNames,
  getFileSourcePath,
  getLiveAsset,
  isMediaFile,
  logError,
  readEditableFolderFile,
  renderCover,
  renderMedia,
  restoreSavedAsset,
  saveAsset,
  selectedMedia,
  setCoverImage
}: EditorExportAssetWorkflowOptions): EditorExportAssetWorkflow {
  const createEditableFolderAsset = (file: File, reference: string): MediaAsset => {
    const sourcePath = getFileSourcePath(file);
    const referencePath = normalizeImportedAssetReference(reference) || normalizeImportedAssetReference(sourcePath);
    const referenceFileName = referencePath.split('/').pop() || sourcePath.split('/').pop() || file.name;
    const name = dedupeFileName(sanitizeFileName(referenceFileName), getCurrentAssetNames());
    return {
      file,
      id: createAssetId(),
      name,
      path: referencePath || name,
      sourcePath,
      url: URL.createObjectURL(file)
    };
  };

  const trackRecoveredEditableAsset = (asset: MediaAsset, documentRecord: DocumentRecord, reference: string) => {
    if (getLiveAsset({ path: asset.path }) || getLiveAsset({ path: asset.sourcePath })) return;

    const mediaPath = getDocumentFieldValue(documentRecord, 'image');
    if (normalizeDocumentAssetPath(mediaPath) === normalizeDocumentAssetPath(reference)) {
      documentRecord.coverImage = serializeAssetMetadata(asset);
      if (documentRecord.id === getActiveDocumentId()) {
        setCoverImage(asset);
        renderCover();
      }
      return;
    }

    selectedMedia.push(asset);
    renderMedia();
  };

  const restoreAssetFromEditableFolder = async (path: string, documentRecord: DocumentRecord): Promise<MediaAsset | null> => {
    const editableFolder = editableFolders.get(documentRecord.id);
    if (!editableFolder?.directoryHandle) return null;

    try {
      const mediaFile = await readEditableFolderFile(editableFolder.directoryHandle, path);
      if (!isMediaFile(mediaFile)) return null;

      const asset = createEditableFolderAsset(mediaFile, normalizeDocumentAssetPath(path));
      trackRecoveredEditableAsset(asset, documentRecord, path);
      await saveAsset(asset);
      return asset;
    } catch (error) {
      logError('Could not restore a referenced media asset from the editable folder.', error, {
        documentId: documentRecord.id,
        path
      });
      return null;
    }
  };

  const resolveAssetForPath = async (path: string, documentRecord: DocumentRecord): Promise<MediaAsset | null> => {
    return await resolveExportAsset(path, documentRecord, {
      documents,
      getLiveAsset: (assetPath) => getLiveAsset({ path: assetPath }),
      restoreAssetFromEditableFolder,
      restoreSavedAsset
    });
  };

  return {
    async getUniqueAssetFiles(documentRecords) {
      return await collectExportAssets(documentRecords, {
        resolveAssetForPath
      });
    }
  };
}

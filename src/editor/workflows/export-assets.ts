import {
  serializeAssetMetadata
} from '../../images/image-library';
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
  ImageAsset,
  DocumentRecord,
  EditableFolderState
} from '../../shared/types';

export interface EditorExportAssetWorkflow {
  getUniqueAssetFiles(documentRecords: DocumentRecord[]): Promise<ImageAsset[]>;
}

export interface EditorExportAssetWorkflowOptions {
  createAssetId(): string;
  documents: DocumentRecord[];
  editableFolders: Map<string, EditableFolderState>;
  getActiveDocumentId(): string;
  getCurrentAssetNames(): string[];
  getFileSourcePath(file: File): string;
  getLiveAsset(metadata: { path?: string; sourcePath?: string } | null | undefined): ImageAsset | null;
  isImageFile(file: File): boolean;
  logError(message: string, error: unknown, details?: Record<string, unknown>): void;
  readEditableFolderFile(directoryHandle: FileSystemDirectoryHandle, path: string): Promise<File>;
  renderCover(): void;
  renderImages(): void;
  restoreSavedAsset(metadata: DocumentRecord['coverImage']): Promise<ImageAsset | null>;
  saveAsset(asset: ImageAsset): Promise<void>;
  selectedImages: ImageAsset[];
  setCoverImage(asset: ImageAsset): void;
}

export function createEditorExportAssetWorkflow({
  createAssetId,
  documents,
  editableFolders,
  getActiveDocumentId,
  getCurrentAssetNames,
  getFileSourcePath,
  getLiveAsset,
  isImageFile,
  logError,
  readEditableFolderFile,
  renderCover,
  renderImages,
  restoreSavedAsset,
  saveAsset,
  selectedImages,
  setCoverImage
}: EditorExportAssetWorkflowOptions): EditorExportAssetWorkflow {
  const createEditableFolderAsset = (file: File, reference: string): ImageAsset => {
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

  const trackRecoveredEditableAsset = (asset: ImageAsset, documentRecord: DocumentRecord, reference: string) => {
    if (getLiveAsset({ path: asset.path }) || getLiveAsset({ path: asset.sourcePath })) return;

    const imagePath = getDocumentFieldValue(documentRecord, 'image');
    if (normalizeDocumentAssetPath(imagePath) === normalizeDocumentAssetPath(reference)) {
      documentRecord.coverImage = serializeAssetMetadata(asset);
      if (documentRecord.id === getActiveDocumentId()) {
        setCoverImage(asset);
        renderCover();
      }
      return;
    }

    selectedImages.push(asset);
    renderImages();
  };

  const restoreAssetFromEditableFolder = async (path: string, documentRecord: DocumentRecord): Promise<ImageAsset | null> => {
    const editableFolder = editableFolders.get(documentRecord.id);
    if (!editableFolder?.directoryHandle) return null;

    try {
      const imageFile = await readEditableFolderFile(editableFolder.directoryHandle, path);
      if (!isImageFile(imageFile)) return null;

      const asset = createEditableFolderAsset(imageFile, normalizeDocumentAssetPath(path));
      trackRecoveredEditableAsset(asset, documentRecord, path);
      await saveAsset(asset);
      return asset;
    } catch (error) {
      logError('Could not restore a referenced image from the editable folder.', error, {
        documentId: documentRecord.id,
        path
      });
      return null;
    }
  };

  const resolveAssetForPath = async (path: string, documentRecord: DocumentRecord): Promise<ImageAsset | null> => {
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

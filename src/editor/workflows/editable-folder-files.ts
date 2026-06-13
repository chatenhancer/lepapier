import {
  createEditableFileDocumentFile,
  createEditableFolderDocumentFiles
} from '../../export/document-files';
import {
  readEditableFolderAsset,
  writeEditableFolderFile as writeNormalizedEditableFolderFile
} from '../../export/export-assets';
import {
  readEditableFolderFile as readEditableFolderFileFromHandle,
  readEditableFolderFiles as readEditableFolderFilesFromHandle,
  writeDataToEditableFile,
  writeFileToEditableFolder as writeDataToEditableFolder
} from '../../filesystem/editable-folder';
import { normalizeImportPath } from '../../documents/document-import';
import { normalizeDocumentAssetPath } from '../../documents/document-markdown';
import type {
  MediaAsset,
  DocumentRecord
} from '../../shared/types';

export interface EditorEditableFolderFiles {
  getImportFilePath(file: File): string;
  readAssetForEditableFolder(asset: MediaAsset, directoryHandle: FileSystemDirectoryHandle | undefined): Promise<Uint8Array<ArrayBuffer>>;
  readEditableFolderFile(directoryHandle: FileSystemDirectoryHandle, path: string): Promise<File>;
  readEditableFolderFiles(directoryHandle: FileSystemDirectoryHandle): Promise<File[]>;
  validateEditableFolderDocument(
    documentRecord: DocumentRecord,
    directoryHandle: FileSystemDirectoryHandle | undefined,
    resolveAssets: (documentRecords: DocumentRecord[]) => Promise<MediaAsset[]>
  ): Promise<void>;
  writeDocumentToEditableFolder(
    documentRecord: DocumentRecord,
    directoryHandle: FileSystemDirectoryHandle,
    resolveAssets: (documentRecords: DocumentRecord[]) => Promise<MediaAsset[]>,
    options?: { randomizeMediaNames?: boolean }
  ): Promise<void>;
  writeDocumentToEditableFile(
    documentRecord: DocumentRecord,
    fileHandle: FileSystemFileHandle,
    resolveAssets: (documentRecords: DocumentRecord[]) => Promise<MediaAsset[]>
  ): Promise<void>;
}

export interface EditorEditableFolderFilesOptions {
  isMediaFile(file: File): boolean;
  logError(message: string, error: unknown, details?: Record<string, unknown>): void;
}

export function createEditorEditableFolderFiles({
  isMediaFile,
  logError
}: EditorEditableFolderFilesOptions): EditorEditableFolderFiles {
  const importFileRelativePaths = new WeakMap<File, string>();

  const getImportFilePath = (file: File) => {
    return normalizeImportPath(importFileRelativePaths.get(file) || file.webkitRelativePath || file.name);
  };

  const readEditableFolderFile = async (directoryHandle: FileSystemDirectoryHandle, path: string): Promise<File> => {
    return await readEditableFolderFileFromHandle(directoryHandle, path, normalizeDocumentAssetPath, (file, relativePath) => {
      importFileRelativePaths.set(file, relativePath);
    });
  };

  const readEditableFolderFiles = async (directoryHandle: FileSystemDirectoryHandle): Promise<File[]> => {
    return await readEditableFolderFilesFromHandle(directoryHandle, (file, relativePath) => {
      importFileRelativePaths.set(file, relativePath);
    });
  };

  const readAssetForEditableFolder = async (
    asset: MediaAsset,
    directoryHandle: FileSystemDirectoryHandle | undefined
  ): Promise<Uint8Array<ArrayBuffer>> => {
    return await readEditableFolderAsset(asset, directoryHandle, {
      isMediaFile,
      logError,
      readFile: (path) => readEditableFolderFile(directoryHandle as FileSystemDirectoryHandle, path)
    });
  };

  const writeFileToEditableFolder = async (
    directoryHandle: FileSystemDirectoryHandle,
    path: string,
    data: Uint8Array<ArrayBuffer>
  ): Promise<void> => {
    await writeNormalizedEditableFolderFile(path, data, {
      logError,
      writeFile: (normalizedPath, fileData) => writeDataToEditableFolder(directoryHandle, normalizedPath, fileData)
    });
  };

  const createEditableFolderFiles = async (
    documentRecord: DocumentRecord,
    directoryHandle: FileSystemDirectoryHandle | undefined,
    resolveAssets: (documentRecords: DocumentRecord[]) => Promise<MediaAsset[]>,
    { randomizeMediaNames = false }: { randomizeMediaNames?: boolean } = {}
  ) => {
    return await createEditableFolderDocumentFiles({
      documentRecord,
      randomizeMediaNames,
      readAssetData: (asset) => readAssetForEditableFolder(asset, directoryHandle),
      resolveAssets
    });
  };

  const validateEditableFolderDocument = async (
    documentRecord: DocumentRecord,
    directoryHandle: FileSystemDirectoryHandle | undefined,
    resolveAssets: (documentRecords: DocumentRecord[]) => Promise<MediaAsset[]>
  ): Promise<void> => {
    await createEditableFolderFiles(documentRecord, directoryHandle, resolveAssets);
  };

  const writeDocumentToEditableFolder = async (
    documentRecord: DocumentRecord,
    directoryHandle: FileSystemDirectoryHandle,
    resolveAssets: (documentRecords: DocumentRecord[]) => Promise<MediaAsset[]>,
    { randomizeMediaNames = false }: { randomizeMediaNames?: boolean } = {}
  ): Promise<void> => {
    const files = await createEditableFolderFiles(documentRecord, directoryHandle, resolveAssets, {
      randomizeMediaNames
    });

    for (const file of files) {
      try {
        await writeFileToEditableFolder(directoryHandle, file.path, file.data);
      } catch (error) {
        logError('Could not write a document file to the editable folder.', error, {
          path: file.path,
          size: file.data.byteLength
        });
        throw error;
      }
    }
  };

  return {
    getImportFilePath,
    readAssetForEditableFolder,
    readEditableFolderFile,
    readEditableFolderFiles,
    validateEditableFolderDocument,
    async writeDocumentToEditableFile(documentRecord, fileHandle, resolveAssets) {
      const file = await createEditableFileDocumentFile({
        documentRecord,
        readAssetData: (asset) => readAssetForEditableFolder(asset, undefined),
        resolveAssets
      });
      await writeDataToEditableFile(fileHandle, file.data);
    },
    writeDocumentToEditableFolder
  };
}

import { createIndexedDbStore } from '../storage/indexeddb-store';
import { createLocalDraftStore } from '../storage/local-draft-store';
import type {
  ImageAsset,
  WorkspaceDraft
} from '../shared/types';

export interface EditorStorage {
  clearAssets(): Promise<void>;
  clearDraft(): void;
  clearEditableFolderHandles(): Promise<void>;
  deleteEditableFolderHandle(documentId: string): Promise<void>;
  readAsset(id: string): Promise<{ file?: File } | null>;
  readDraft(): WorkspaceDraft | null;
  readEditableFileHandle(documentId: string): Promise<{ fileHandle?: FileSystemFileHandle } | null>;
  readEditableFolderHandle(documentId: string): Promise<{ directoryHandle?: FileSystemDirectoryHandle } | null>;
  saveAsset(asset: ImageAsset): Promise<void>;
  saveEditableFileHandle(documentId: string, fileHandle: FileSystemFileHandle): Promise<void>;
  saveEditableFolderHandle(documentId: string, directoryHandle: FileSystemDirectoryHandle): Promise<void>;
  writeDraft(draft: WorkspaceDraft): void;
}

export interface CreateEditorStorageOptions {
  storageNamespace: string;
}

export function createEditorStorage({ storageNamespace }: CreateEditorStorageOptions): EditorStorage {
  const indexedDbStore = createIndexedDbStore({
    assetStoreName: 'assets',
    databaseName: `${storageNamespace}-assets`,
    editableFolderStoreName: 'editable-folders',
    version: 2
  });
  const draftStore = createLocalDraftStore(`${storageNamespace}-draft-v1`);

  return {
    async clearAssets() {
      await indexedDbStore.clearAssets();
    },
    clearDraft() {
      draftStore.clear();
    },
    async clearEditableFolderHandles() {
      await indexedDbStore.clearEditableFolderHandles();
    },
    async deleteEditableFolderHandle(documentId) {
      await indexedDbStore.deleteEditableFolderHandle(documentId);
    },
    async readAsset(id) {
      return await indexedDbStore.readAsset(id);
    },
    readDraft() {
      return draftStore.read();
    },
    async readEditableFolderHandle(documentId) {
      return await indexedDbStore.readEditableFolderHandle(documentId);
    },
    async readEditableFileHandle(documentId) {
      return await indexedDbStore.readEditableFileHandle(documentId);
    },
    async saveAsset(asset) {
      await indexedDbStore.saveAsset({ file: asset.file, id: asset.id });
    },
    async saveEditableFileHandle(documentId, fileHandle) {
      await indexedDbStore.saveEditableFileHandle(documentId, fileHandle);
    },
    async saveEditableFolderHandle(documentId, directoryHandle) {
      await indexedDbStore.saveEditableFolderHandle(documentId, directoryHandle);
    },
    writeDraft(draft) {
      draftStore.write(draft);
    }
  };
}

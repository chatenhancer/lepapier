export interface AssetRecord {
  file: File;
  id: string;
}

export interface EditableFolderRecord {
  directoryHandle: FileSystemDirectoryHandle;
  id: string;
}

export interface EditableFileRecord {
  fileHandle: FileSystemFileHandle;
  id: string;
}

export interface IndexedDbStore {
  clearAssets(): Promise<void>;
  clearEditableFolderHandles(): Promise<void>;
  deleteEditableFolderHandle(documentId: string): Promise<void>;
  readAsset(id: string): Promise<AssetRecord | null>;
  readEditableFileHandle(documentId: string): Promise<EditableFileRecord | null>;
  readEditableFolderHandle(documentId: string): Promise<EditableFolderRecord | null>;
  saveAsset(asset: AssetRecord): Promise<void>;
  saveEditableFileHandle(documentId: string, fileHandle: FileSystemFileHandle): Promise<void>;
  saveEditableFolderHandle(documentId: string, directoryHandle: FileSystemDirectoryHandle): Promise<void>;
}

export function createIndexedDbStore(options: {
  assetStoreName: string;
  databaseName: string;
  editableFolderStoreName: string;
  version: number;
}): IndexedDbStore {
  let databasePromise: Promise<IDBDatabase> | null = null;

  function getDatabase(): Promise<IDBDatabase> {
    if (databasePromise) return databasePromise;

    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(options.databaseName, options.version);
      request.addEventListener('upgradeneeded', () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(options.assetStoreName)) {
          database.createObjectStore(options.assetStoreName, { keyPath: 'id' });
        }
        if (!database.objectStoreNames.contains(options.editableFolderStoreName)) {
          database.createObjectStore(options.editableFolderStoreName, { keyPath: 'id' });
        }
      });
      request.addEventListener('success', () => {
        resolve(request.result);
      });
      request.addEventListener('error', () => {
        reject(request.error);
      });
    });

    return databasePromise;
  }

  async function runTransaction(storeName: string, mode: IDBTransactionMode, action: (store: IDBObjectStore) => void): Promise<void> {
    const database = await getDatabase();
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, mode);
      action(transaction.objectStore(storeName));
      transaction.addEventListener('complete', () => {
        resolve();
      });
      transaction.addEventListener('error', () => {
        reject(transaction.error);
      });
      transaction.addEventListener('abort', () => {
        reject(transaction.error);
      });
    });
  }

  async function readRecord<T>(storeName: string, id: string): Promise<T | null> {
    const database = await getDatabase();
    return await new Promise((resolve, reject) => {
      const transaction = database.transaction(storeName, 'readonly');
      const request = transaction.objectStore(storeName).get(id);
      request.addEventListener('success', () => {
        resolve(request.result || null);
      });
      request.addEventListener('error', () => {
        reject(request.error);
      });
    });
  }

  return {
    async clearAssets() {
      if (!('indexedDB' in window)) return;
      await runTransaction(options.assetStoreName, 'readwrite', (store) => {
        store.clear();
      });
    },
    async clearEditableFolderHandles() {
      if (!('indexedDB' in window)) return;
      await runTransaction(options.editableFolderStoreName, 'readwrite', (store) => {
        store.clear();
      });
    },
    async deleteEditableFolderHandle(documentId) {
      if (!documentId || !('indexedDB' in window)) return;
      await runTransaction(options.editableFolderStoreName, 'readwrite', (store) => {
        store.delete(documentId);
      });
    },
    async readAsset(id) {
      if (!id || !('indexedDB' in window)) return null;
      return await readRecord<AssetRecord>(options.assetStoreName, id);
    },
    async readEditableFolderHandle(documentId) {
      if (!documentId || !('indexedDB' in window)) return null;
      const record = await readRecord<EditableFolderRecord>(options.editableFolderStoreName, documentId);
      return record?.directoryHandle ? record : null;
    },
    async readEditableFileHandle(documentId) {
      if (!documentId || !('indexedDB' in window)) return null;
      const record = await readRecord<EditableFileRecord>(options.editableFolderStoreName, documentId);
      return record?.fileHandle ? record : null;
    },
    async saveAsset(asset) {
      if (!asset?.id || !('indexedDB' in window)) return;
      await runTransaction(options.assetStoreName, 'readwrite', (store) => {
        store.put(asset);
      });
    },
    async saveEditableFileHandle(documentId, fileHandle) {
      if (!documentId || !fileHandle || !('indexedDB' in window)) return;
      await runTransaction(options.editableFolderStoreName, 'readwrite', (store) => {
        store.put({
          fileHandle,
          id: documentId
        });
      });
    },
    async saveEditableFolderHandle(documentId, directoryHandle) {
      if (!documentId || !directoryHandle || !('indexedDB' in window)) return;
      await runTransaction(options.editableFolderStoreName, 'readwrite', (store) => {
        store.put({
          directoryHandle,
          id: documentId
        });
      });
    }
  };
}

import { getDocumentFieldValue } from '../../documents/document-markdown';
import type { DocumentRecord, EditableFileState, EditableFolderState } from '../../shared/types';

export interface EditorFolderSync {
  markEditableFolderDisconnected(documentId: string): void;
  reconnectEditableFolder(
    documentId: string,
    options?: { markConnected?: boolean; silent?: boolean }
  ): Promise<boolean>;
  reconnectEditableFolderForDocument(documentId: string): Promise<void>;
  saveCurrentDocument(options?: { feedback?: boolean }): Promise<void>;
}

export interface EditorFolderSyncOptions {
  editableFolders: Map<string, EditableFolderState>;
  editableFiles: Map<string, EditableFileState>;
  ensureEditableFilePermission(fileHandle: FileSystemFileHandle): Promise<boolean>;
  ensureEditableFolderPermission(directoryHandle: FileSystemDirectoryHandle): Promise<boolean>;
  getCurrentDocumentForExport(): DocumentRecord;
  getDocumentForExportById(documentId: string): DocumentRecord | null;
  logError(message: string, error: unknown, details?: Record<string, unknown>): void;
  renderDocumentsList(): void;
  saveDraft(options?: { feedback?: boolean; touch?: boolean }): void;
  showSaveState(text: string, options?: { feedback?: boolean }): void;
  validateEditableFolderDocument(
    documentRecord: DocumentRecord,
    directoryHandle: FileSystemDirectoryHandle | undefined
  ): Promise<void>;
  writeDocumentToEditableFolder(
    documentRecord: DocumentRecord,
    directoryHandle: FileSystemDirectoryHandle
  ): Promise<void>;
  writeDocumentToEditableFile(
    documentRecord: DocumentRecord,
    fileHandle: FileSystemFileHandle
  ): Promise<void>;
}

export function createEditorFolderSync({
  editableFiles,
  editableFolders,
  ensureEditableFilePermission,
  ensureEditableFolderPermission,
  getCurrentDocumentForExport,
  getDocumentForExportById,
  logError,
  renderDocumentsList,
  saveDraft,
  showSaveState,
  validateEditableFolderDocument,
  writeDocumentToEditableFile,
  writeDocumentToEditableFolder
}: EditorFolderSyncOptions): EditorFolderSync {
  let folderSavePromise = Promise.resolve();

  const markEditableFolderDisconnected = (documentId: string) => {
    const editableFolder = editableFolders.get(documentId);
    if (!editableFolder) return;

    editableFolder.connected = false;
    renderDocumentsList();
  };

  const reconnectEditableFolder = async (
    documentId: string,
    { markConnected = true, silent = false }: { markConnected?: boolean; silent?: boolean } = {}
  ): Promise<boolean> => {
    const editableFolder = editableFolders.get(documentId);
    if (!editableFolder?.directoryHandle) {
      if (!silent) showSaveState('No editable folder is stored for this document');
      return false;
    }

    try {
      const permissionGranted = await ensureEditableFolderPermission(editableFolder.directoryHandle);
      if (!permissionGranted) {
        editableFolder.connected = false;
        renderDocumentsList();
        if (!silent) showSaveState('Folder write permission was not granted');
        return false;
      }

      if (markConnected) {
        editableFolder.connected = true;
        renderDocumentsList();
      }

      if (!silent) showSaveState('Folder reconnected');
      return true;
    } catch (error) {
      console.error(error);
      editableFolder.connected = false;
      renderDocumentsList();
      if (!silent) showSaveState('Could not reconnect folder');
      return false;
    }
  };

  const reconnectEditableFile = async (
    documentId: string,
    { markConnected = true, silent = false }: { markConnected?: boolean; silent?: boolean } = {}
  ): Promise<boolean> => {
    const editableFile = editableFiles.get(documentId);
    if (!editableFile?.fileHandle) {
      if (!silent) showSaveState('No editable file is stored for this document');
      return false;
    }

    try {
      const permissionGranted = await ensureEditableFilePermission(editableFile.fileHandle);
      if (!permissionGranted) {
        editableFile.connected = false;
        renderDocumentsList();
        if (!silent) showSaveState('File write permission was not granted');
        return false;
      }

      if (markConnected) {
        editableFile.connected = true;
        renderDocumentsList();
      }

      if (!silent) showSaveState('File reconnected');
      return true;
    } catch (error) {
      console.error(error);
      editableFile.connected = false;
      renderDocumentsList();
      if (!silent) showSaveState('Could not reconnect file');
      return false;
    }
  };

  const saveDocumentToEditableFolder = async (
    documentRecord: DocumentRecord,
    { feedback = false }: { feedback?: boolean } = {}
  ): Promise<void> => {
    const editableFolder = editableFolders.get(documentRecord.id);
    if (!editableFolder) return;

    try {
      const connected = editableFolder.connected || await reconnectEditableFolder(documentRecord.id, { markConnected: false, silent: true });
      if (!connected) return;

      showSaveState('Saving to folder...');
      await writeDocumentToEditableFolder(documentRecord, editableFolder.directoryHandle);
      editableFolder.connected = true;
      renderDocumentsList();
      saveDraft({ touch: false });
      showSaveState('Saved to folder', { feedback });
    } catch (error) {
      markEditableFolderDisconnected(documentRecord.id);
      logError('Could not save the current document to its editable folder.', error, {
        documentId: documentRecord.id,
        slug: getDocumentFieldValue(documentRecord, 'slug'),
        title: getDocumentFieldValue(documentRecord, 'title')
      });
      showSaveState('Could not save to folder', { feedback });
    }
  };

  const saveDocumentToEditableFile = async (
    documentRecord: DocumentRecord,
    { feedback = false }: { feedback?: boolean } = {}
  ): Promise<void> => {
    const editableFile = editableFiles.get(documentRecord.id);
    if (!editableFile) return;

    try {
      const connected = editableFile.connected || await reconnectEditableFile(documentRecord.id, { markConnected: false, silent: true });
      if (!connected) return;

      showSaveState('Saving to file...');
      await writeDocumentToEditableFile(documentRecord, editableFile.fileHandle);
      editableFile.connected = true;
      renderDocumentsList();
      saveDraft({ touch: false });
      showSaveState('Saved to file', { feedback });
    } catch (error) {
      editableFile.connected = false;
      renderDocumentsList();
      logError('Could not save the current document to its editable file.', error, {
        documentId: documentRecord.id,
        slug: getDocumentFieldValue(documentRecord, 'slug'),
        title: getDocumentFieldValue(documentRecord, 'title')
      });
      showSaveState('Could not save to file', { feedback });
    }
  };

  const saveCurrentDocument = async ({ feedback = false }: { feedback?: boolean } = {}) => {
    saveDraft({ feedback });

    const documentRecord = getCurrentDocumentForExport();
    const saveJob = folderSavePromise.then(async () => {
      if (editableFiles.has(documentRecord.id)) {
        await saveDocumentToEditableFile(documentRecord, { feedback });
        return;
      }
      await saveDocumentToEditableFolder(documentRecord, { feedback });
    });
    folderSavePromise = saveJob.catch(() => undefined);
    await saveJob;
  };

  const reconnectEditableFolderForDocument = async (documentId: string) => {
    saveDraft({ touch: false });

    const documentRecord = getDocumentForExportById(documentId);
    if (!documentRecord) {
      showSaveState('Document no longer exists');
      return;
    }

    const connected = editableFiles.has(documentId)
      ? await reconnectEditableFile(documentId, { markConnected: false, silent: true })
      : await reconnectEditableFolder(documentId, { markConnected: false, silent: true });
    if (!connected) {
      showSaveState(editableFiles.has(documentId) ? 'Could not reconnect file' : 'Could not reconnect folder');
      return;
    }

    try {
      const editableFile = editableFiles.get(documentId);
      if (editableFile) {
        editableFile.connected = true;
        saveDraft({ touch: false });
        renderDocumentsList();
        showSaveState('File reconnected');
        return;
      }

      const editableFolder = editableFolders.get(documentId);
      await validateEditableFolderDocument(documentRecord, editableFolder?.directoryHandle);
      if (editableFolder) {
        editableFolder.connected = true;
      }
      saveDraft({ touch: false });
      renderDocumentsList();
      showSaveState('Folder reconnected');
    } catch (error) {
      markEditableFolderDisconnected(documentId);
      logError('Could not validate the editable folder document after reconnecting.', error, {
        documentId,
        slug: getDocumentFieldValue(documentRecord, 'slug'),
        title: getDocumentFieldValue(documentRecord, 'title')
      });
      showSaveState('Could not bundle every media asset');
    }
  };

  return {
    markEditableFolderDisconnected,
    reconnectEditableFolder,
    reconnectEditableFolderForDocument,
    saveCurrentDocument
  };
}

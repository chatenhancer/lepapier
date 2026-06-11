import {
  canPickDirectory,
  canPickWritableFile,
  canPickWritableDirectory,
  pickReadableDirectory,
  pickWritableMarkdownFile,
  pickWritableDirectory
} from '../../browser/file-system-access';
import { getImportMarkdownFiles } from '../../documents/document-import';
import {
  readEditableFile
} from '../../filesystem/editable-folder';
import type {
  DocumentSourceMode
} from '../../shared/types';

export interface EditorOpenWorkflow {
  openEditableDocumentFile(): Promise<void>;
  openEditableDocumentFolder(): Promise<void>;
  openDocumentFolder(): Promise<void>;
  openDocumentFiles(files: File[]): Promise<void>;
}

export interface EditorOpenWorkflowOptions {
  ensureEditableFolderPermission(directoryHandle: FileSystemDirectoryHandle): Promise<boolean>;
  ensureEditableFilePermission(fileHandle: FileSystemFileHandle): Promise<boolean>;
  importDocumentFiles(
    markdownFiles: File[],
    files: File[],
    options: {
      directoryHandle?: FileSystemDirectoryHandle;
      fileHandle?: FileSystemFileHandle;
      sourceMode: DocumentSourceMode;
    }
  ): Promise<void>;
  readEditableFolderFiles(directoryHandle: FileSystemDirectoryHandle): Promise<File[]>;
  saveDraft(): void;
  showSaveState(text: string): void;
}

export function createEditorOpenWorkflow({
  ensureEditableFolderPermission,
  ensureEditableFilePermission,
  importDocumentFiles,
  readEditableFolderFiles,
  saveDraft,
  showSaveState
}: EditorOpenWorkflowOptions): EditorOpenWorkflow {
  const openDocumentFiles = async (files: File[]) => {
    const markdownFiles = getImportMarkdownFiles(files);
    if (!markdownFiles.length) {
      showSaveState('Select a Markdown .md file to open');
      return;
    }

    saveDraft();
    showSaveState('Opening document...');

    try {
      await importDocumentFiles(markdownFiles, markdownFiles, { sourceMode: 'file' });
      showSaveState(markdownFiles.length === 1 ? 'Opened document' : 'Opened documents');
    } catch (error) {
      console.error(error);
      showSaveState('Could not open document');
    }
  };

  const openDocumentFolder = async () => {
    if (!canPickDirectory()) {
      showSaveState('Folder open needs a Chromium browser');
      return;
    }

    try {
      const directoryHandle = await pickReadableDirectory();
      const files = await readEditableFolderFiles(directoryHandle);
      const markdownFiles = getImportMarkdownFiles(files);
      if (!markdownFiles.length) {
        showSaveState('Select a folder with Markdown files');
        return;
      }

      saveDraft();
      showSaveState('Opening documents...');

      await importDocumentFiles(markdownFiles, files, { sourceMode: 'folder' });
      showSaveState(markdownFiles.length === 1 ? 'Opened document' : 'Opened documents');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        showSaveState('Folder open cancelled');
        return;
      }

      console.error(error);
      showSaveState('Could not open folder');
    }
  };

  const openEditableDocumentFile = async () => {
    if (!canPickWritableFile()) {
      showSaveState('Document file sync needs a Chromium browser');
      return;
    }

    try {
      const fileHandle = await pickWritableMarkdownFile();
      const permissionGranted = await ensureEditableFilePermission(fileHandle);
      if (!permissionGranted) {
        showSaveState('File write permission was not granted');
        return;
      }

      const markdownFile = await readEditableFile(fileHandle);
      saveDraft();
      showSaveState('Opening and syncing document...');

      await importDocumentFiles([markdownFile], [markdownFile], {
        fileHandle,
        sourceMode: 'editable-file'
      });
      showSaveState('Opened and syncing document');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        showSaveState('File open cancelled');
        return;
      }

      console.error(error);
      showSaveState('Could not open and sync document');
    }
  };

  const openEditableDocumentFolder = async () => {
    if (!canPickWritableDirectory()) {
      showSaveState('Document sync needs a Chromium browser');
      return;
    }

    try {
      const directoryHandle = await pickWritableDirectory();
      const permissionGranted = await ensureEditableFolderPermission(directoryHandle);
      if (!permissionGranted) {
        showSaveState('Folder write permission was not granted');
        return;
      }

      const files = await readEditableFolderFiles(directoryHandle);
      const markdownFiles = getImportMarkdownFiles(files);
      if (!markdownFiles.length) {
        showSaveState('Select a folder with Markdown files');
        return;
      }

      saveDraft();
      showSaveState('Opening and syncing document...');

      await importDocumentFiles(markdownFiles, files, {
        directoryHandle,
        sourceMode: 'editable-folder'
      });
      showSaveState(markdownFiles.length === 1 ? 'Opened and syncing document' : 'Opened and syncing documents');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        showSaveState('Folder open cancelled');
        return;
      }

      console.error(error);
      showSaveState('Could not open and sync document');
    }
  };

  return {
    openEditableDocumentFile,
    openEditableDocumentFolder,
    openDocumentFolder,
    openDocumentFiles
  };
}

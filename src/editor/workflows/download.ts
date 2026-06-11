import { downloadBlob } from '../../browser/download';
import {
  createPortableDocumentFiles
} from '../../export/document-files';
import { createZip } from '../../export/zip';
import { getPathBasename } from '../../documents/document-markdown';
import type {
  ImageAsset,
  DocumentRecord
} from '../../shared/types';
import { playDownloadAnimation } from '../../ui/download-animation';

export interface EditorDownloadWorkflow {
  downloadAll(): Promise<void>;
  downloadDocument(): Promise<void>;
}

export interface EditorDownloadWorkflowOptions {
  fallbackMs: number;
  getDocumentsForExport(): DocumentRecord[];
  getPrimaryDocumentsForExport(): DocumentRecord[];
  isRandomizeImageNamesEnabled(): boolean;
  paper: HTMLElement;
  resolveAssets(documentRecords: DocumentRecord[]): Promise<ImageAsset[]>;
  saveDraft(): void;
  showSaveState(text: string): void;
  writingColumn: HTMLElement;
}

export function createEditorDownloadWorkflow({
  fallbackMs,
  getDocumentsForExport,
  getPrimaryDocumentsForExport,
  isRandomizeImageNamesEnabled,
  paper,
  resolveAssets,
  saveDraft,
  showSaveState,
  writingColumn
}: EditorDownloadWorkflowOptions): EditorDownloadWorkflow {
  const runDownloadAction = async (download: () => Promise<void>): Promise<void> => {
    saveDraft();
    void playDownloadAnimation({
      fallbackMs,
      paper,
      writingColumn
    });
    try {
      await download();
    } catch (error) {
      console.error(error);
      showSaveState('Could not bundle every image');
    }
  };

  return {
    async downloadAll() {
      await runDownloadAction(async () => {
        const files = await createPortableDocumentFiles({
          documentRecords: getDocumentsForExport(),
          randomizeImageNames: isRandomizeImageNamesEnabled(),
          resolveAssets
        });
        await downloadFiles(files, 'lepapier-documents.zip');
      });
    },
    async downloadDocument() {
      await runDownloadAction(async () => {
        const documentRecords = getPrimaryDocumentsForExport();
        const files = await createPortableDocumentFiles({
          documentRecords,
          randomizeImageNames: isRandomizeImageNamesEnabled(),
          resolveAssets
        });
        await downloadFiles(files, documentRecords.length === 1 ? `${getFileStem(getPathBasename(files[0]?.path || 'document'))}.zip` : 'lepapier-documents.zip');
      });
    }
  };

  async function downloadFiles(files: Awaited<ReturnType<typeof createPortableDocumentFiles>>, zipName: string): Promise<void> {
    if (files.length === 1 && /\.md$/i.test(files[0].path)) {
      downloadBlob(getPathBasename(files[0].path), new Blob([files[0].data], { type: 'text/markdown;charset=utf-8' }));
      return;
    }

    downloadBlob(zipName, await createZip(files));
  }
}

function getFileStem(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
}

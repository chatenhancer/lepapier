import { serializeAssetMetadata } from '../../images/image-library';
import type {
  AssetMetadata,
  ImageAsset,
  DocumentRecord,
  WorkspaceDraft
} from '../../shared/types';

export interface EditorDraftPersistence {
  persistDraft(): void;
  saveDraftNow(options?: { feedback?: boolean; touch?: boolean }): void;
}

export interface EditorDraftPersistenceOptions {
  documents: DocumentRecord[];
  getActiveDocumentId(): string;
  getRandomizeImageNames(): boolean;
  getSmartPunctuation(): boolean;
  images: ImageAsset[];
  logError(message: string, error: unknown, details?: Record<string, unknown>): void;
  renderDocumentsList(): void;
  showSaveState(text: string, options?: { feedback?: boolean }): void;
  updateActiveDocument(options: { touch: boolean }): DocumentRecord | null;
  windowTarget?: Window;
  writeDraft(draft: WorkspaceDraft): void;
}

export function createEditorDraftPersistence({
  documents,
  getActiveDocumentId,
  getRandomizeImageNames,
  getSmartPunctuation,
  images,
  logError,
  renderDocumentsList,
  showSaveState,
  updateActiveDocument,
  windowTarget = window,
  writeDraft
}: EditorDraftPersistenceOptions): EditorDraftPersistence {
  let saveTimeout = 0;

  const saveDraftNow = ({ feedback = false, touch = true }: { feedback?: boolean; touch?: boolean } = {}) => {
    windowTarget.clearTimeout(saveTimeout);

    updateActiveDocument({ touch });
    const draft: WorkspaceDraft = {
      activeDocumentId: getActiveDocumentId(),
      documents,
      images: images.map((asset) => serializeAssetMetadata(asset)).filter((asset): asset is AssetMetadata => Boolean(asset)),
      randomizeImageNames: getRandomizeImageNames(),
      smartPunctuation: getSmartPunctuation(),
      version: 3
    };
    try {
      writeDraft(draft);
      renderDocumentsList();
      showSaveState('Saved in browser', { feedback });
    } catch (error) {
      logError('Could not save the local blog editor draft.', error, {
        activeDocumentId: getActiveDocumentId(),
        documentCount: documents.length
      });
      showSaveState('Could not save in browser');
    }
  };

  const persistDraft = () => {
    windowTarget.clearTimeout(saveTimeout);
    showSaveState('Saving in browser...');
    saveTimeout = windowTarget.setTimeout(() => {
      saveDraftNow();
    }, 180);
  };

  return {
    persistDraft,
    saveDraftNow
  };
}

import { serializeAssetMetadata } from '../../media/media-library';
import type {
  AssetMetadata,
  MediaAsset,
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
  getRandomizeMediaNames(): boolean;
  getSmartPunctuation(): boolean;
  media: MediaAsset[];
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
  getRandomizeMediaNames,
  getSmartPunctuation,
  media,
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
      media: media.map((asset) => serializeAssetMetadata(asset)).filter((asset): asset is AssetMetadata => Boolean(asset)),
      randomizeMediaNames: getRandomizeMediaNames(),
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

import type { WorkspaceDraft } from '../shared/types';

export interface LocalDraftStore {
  clear(): void;
  read(): WorkspaceDraft | null;
  write(draft: WorkspaceDraft): void;
}

export function createLocalDraftStore(storageKey: string, storage: Storage = localStorage): LocalDraftStore {
  return {
    clear() {
      storage.removeItem(storageKey);
    },
    read() {
      try {
        return JSON.parse(storage.getItem(storageKey) || 'null');
      } catch {
        return null;
      }
    },
    write(draft) {
      storage.setItem(storageKey, JSON.stringify(draft));
    }
  };
}

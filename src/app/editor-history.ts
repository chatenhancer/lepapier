export interface EditorHistory<TSnapshot> {
  canRedo(): boolean;
  canUndo(): boolean;
  record(): void;
  redo(): void;
  reset(): void;
  undo(): void;
}

export interface EditorHistoryOptions<TSnapshot> {
  createSnapshot(): TSnapshot;
  getSignature(snapshot: TSnapshot): unknown;
  maximumEntries: number;
  restoreSnapshot(snapshot: TSnapshot): void;
}

export function createEditorHistory<TSnapshot>({
  createSnapshot,
  getSignature,
  maximumEntries,
  restoreSnapshot
}: EditorHistoryOptions<TSnapshot>): EditorHistory<TSnapshot> {
  const redoStack: TSnapshot[] = [];
  const undoStack: TSnapshot[] = [];
  let restoring = false;

  const snapshotsEqual = (first: TSnapshot, second: TSnapshot) => {
    return JSON.stringify(getSignature(first)) === JSON.stringify(getSignature(second));
  };

  const record = () => {
    if (restoring) return;

    const snapshot = createSnapshot();
    const lastSnapshot = undoStack.at(-1);
    if (lastSnapshot && snapshotsEqual(lastSnapshot, snapshot)) return;

    undoStack.push(snapshot);
    if (undoStack.length > maximumEntries) {
      undoStack.shift();
    }
    redoStack.splice(0, redoStack.length);
  };

  const restore = (snapshot: TSnapshot) => {
    restoring = true;
    try {
      restoreSnapshot(snapshot);
    } finally {
      restoring = false;
    }
  };

  return {
    canRedo() {
      return redoStack.length > 0;
    },
    canUndo() {
      return undoStack.length > 0;
    },
    record,
    redo() {
      const snapshot = redoStack.pop();
      if (!snapshot) return;

      undoStack.push(createSnapshot());
      restore(snapshot);
    },
    reset() {
      undoStack.splice(0, undoStack.length);
      redoStack.splice(0, redoStack.length);
    },
    undo() {
      const snapshot = undoStack.pop();
      if (!snapshot) return;

      redoStack.push(createSnapshot());
      restore(snapshot);
    }
  };
}

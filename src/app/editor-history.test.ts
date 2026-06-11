import { describe, expect, it } from 'vitest';

import { createEditorHistory } from './editor-history';

describe('editor history', () => {
  it('records distinct snapshots and restores undo/redo states', () => {
    let value = 'a';
    const restored: string[] = [];
    const history = createEditorHistory({
      createSnapshot: () => value,
      getSignature: (snapshot) => snapshot,
      maximumEntries: 10,
      restoreSnapshot(snapshot) {
        value = snapshot;
        restored.push(snapshot);
      }
    });

    history.record();
    history.record();
    value = 'b';
    history.record();
    value = 'c';

    expect(history.canUndo()).toBe(true);
    history.undo();
    expect(value).toBe('b');
    history.undo();
    expect(value).toBe('a');
    history.redo();
    expect(value).toBe('b');
    expect(restored).toEqual(['b', 'a', 'b']);
  });

  it('can reset undo and redo stacks', () => {
    let value = 'a';
    const history = createEditorHistory({
      createSnapshot: () => value,
      getSignature: (snapshot) => snapshot,
      maximumEntries: 10,
      restoreSnapshot(snapshot) {
        value = snapshot;
      }
    });

    history.record();
    value = 'b';
    history.record();
    history.reset();

    expect(history.canUndo()).toBe(false);
    expect(history.canRedo()).toBe(false);
  });
});

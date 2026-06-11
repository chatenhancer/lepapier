import { describe, expect, it } from 'vitest';

import { getDocumentSelectionRange } from './interactions';

describe('editor interactions helpers', () => {
  it('gets a document selection range from visible checkbox order', () => {
    const root = createSelectionRoot(['first', 'second', 'third', 'fourth']);

    expect(getDocumentSelectionRange(root, 'second', 'fourth')).toEqual(['second', 'third', 'fourth']);
    expect(getDocumentSelectionRange(root, 'fourth', 'second')).toEqual(['second', 'third', 'fourth']);
  });

  it('falls back to the target document when range anchors are missing', () => {
    const root = createSelectionRoot(['first', 'second']);

    expect(getDocumentSelectionRange(root, 'missing', 'second')).toEqual(['second']);
  });
});

function createSelectionRoot(documentIds: string[]): HTMLElement {
  return {
    querySelectorAll() {
      return documentIds.map((documentId) => ({
        dataset: {
          selectDocument: documentId
        }
      }));
    }
  } as unknown as HTMLElement;
}

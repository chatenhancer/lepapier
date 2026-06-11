import { describe, expect, it } from 'vitest';

import {
  createDefaultDocument,
  defaultDocumentBody,
  hasUserWrittenDocumentBody
} from './workspace-state';

describe('workspace state helpers', () => {
  it('treats the untouched starter body as unwritten content', () => {
    expect(createDefaultDocument().fields.body).toBe(defaultDocumentBody);
    expect(hasUserWrittenDocumentBody('')).toBe(false);
    expect(hasUserWrittenDocumentBody(defaultDocumentBody)).toBe(false);
    expect(hasUserWrittenDocumentBody(`${defaultDocumentBody}\n\nA real note.`)).toBe(true);
  });
});

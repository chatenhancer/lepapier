import { describe, expect, it } from 'vitest';

import {
  createBugReportDetails,
  getDocumentSelectionRange
} from './interactions';

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

  it('creates useful bug report details for clipboard copying', () => {
    expect(createBugReportDetails({
      buildTimestamp: '2026-06-11T12:00:00.000Z',
      displayVersion: 'lepapier.app v0.1.0',
      pageHref: 'https://lepapier.app/editor/',
      releaseNotesHref: 'https://github.com/chatenhancer/lepapier/releases',
      userAgent: 'Vitest'
    })).toBe([
      'Lepapier bug report',
      'Version: lepapier.app v0.1.0',
      'Build date: 2026-06-11T12:00:00.000Z',
      'Release notes: https://github.com/chatenhancer/lepapier/releases',
      'App URL: https://lepapier.app/editor/',
      'User agent: Vitest',
      '',
      'What happened:',
      '',
      'What I expected:',
      '',
      'Steps to reproduce:',
      '1. '
    ].join('\n'));
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

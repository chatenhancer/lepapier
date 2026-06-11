import { describe, expect, it } from 'vitest';

import type { DocumentRecord } from '../shared/types';
import {
  formatDocumentCount,
  formatDocumentEditTime,
  getDocumentSyncTooltip,
  getDocumentTitle
} from './document-list-view';

describe('document list view helpers', () => {
  it('gets display titles with an untitled fallback', () => {
    expect(getDocumentTitle(createDocument('  Launch note  '))).toBe('Launch note');
    expect(getDocumentTitle(createDocument(''))).toBe('Untitled document');
    expect(getDocumentTitle(null)).toBe('Untitled document');
  });

  it('formats same-day and older edit timestamps', () => {
    const now = new Date('2026-06-11T12:00:00');

    expect(formatDocumentEditTime(Date.parse('2026-06-11T10:30:00'), now)).toContain('Edited 10:30');
    expect(formatDocumentEditTime(Date.parse('2026-06-10T10:30:00'), now)).toBe('Edited Jun 10');
    expect(formatDocumentEditTime(Number.NaN, now)).toBe('No edits yet');
  });

  it('formats open document counts', () => {
    expect(formatDocumentCount(1)).toBe('1 document open');
    expect(formatDocumentCount(3)).toBe('3 documents open');
    expect(formatDocumentCount(-2)).toBe('0 documents open');
  });

  it('describes the synced source path', () => {
    expect(getDocumentSyncTooltip({
      ...createDocument('Synced'),
      source: {
        markdownPath: 'posts/note.md',
        mode: 'editable-folder'
      }
    })).toBe('Saves back to posts/note.md in the opened folder.');

    expect(getDocumentSyncTooltip({
      ...createDocument('Synced'),
      source: {
        markdownPath: 'note.md',
        mode: 'editable-file'
      }
    })).toBe('Saves back to note.md.');
  });
});

function createDocument(title: string): DocumentRecord {
  return {
    coverImage: null,
    editState: {
      description: false,
      slug: false,
      tags: false,
      title: false
    },
    fields: {
      body: '',
      date: '2026-06-11',
      description: '',
      image: '',
      slug: '',
      tags: '',
      title
    },
    frontmatterExtras: [],
    id: 'document',
    paperWidth: 800,
    updatedAt: 0,
    viewMode: 'write'
  };
}

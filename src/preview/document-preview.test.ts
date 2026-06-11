import { describe, expect, it } from 'vitest';
import { renderDocumentPreview } from './document-preview';

describe('renderDocumentPreview', () => {
  it('escapes document metadata and renders markdown body', () => {
    expect(renderDocumentPreview({
      body: '# Body',
      cover: {
        alt: '"cover"',
        src: 'cover&one.png'
      },
      date: '2026-06-11',
      description: '<summary>',
      renderMarkdown: (markdown) => `<p>${markdown}</p>`,
      tags: 'one, <two>',
      title: '<Title>'
    })).toContain('&lt;Title&gt;');
  });

  it('falls back to an untitled document heading', () => {
    expect(renderDocumentPreview({
      body: '',
      date: '2026-06-11',
      renderMarkdown: () => ''
    })).toContain('Untitled document');
  });
});

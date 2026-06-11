import { describe, expect, it } from 'vitest';

import {
  formatImportedTags,
  getImportTitleFromFile,
  getImportedSlug,
  parseImportedFrontmatter,
  parseImportedMarkdown,
  unquoteImportedYamlValue
} from './frontmatter';

describe('frontmatter import helpers', () => {
  it('parses Markdown frontmatter, body, and unsupported extra lines', () => {
    const parsed = parseImportedMarkdown(`---
title: "Hello paper"
tags:
  - writing
  - launch
layout: custom
draft: "false"
---
# Body
`);

    expect(parsed.body).toBe('# Body\n');
    expect(parsed.frontmatter).toEqual({
      draft: 'false',
      layout: 'custom',
      tags: ['writing', 'launch'],
      title: 'Hello paper'
    });
    expect(parsed.frontmatterExtras).toEqual(['layout: custom', 'draft: "false"']);
  });

  it('returns plain body when no frontmatter exists', () => {
    expect(parseImportedMarkdown('# Body')).toEqual({
      body: '# Body',
      frontmatter: {},
      frontmatterExtras: []
    });
  });

  it('parses scalar and list values from frontmatter', () => {
    expect(parseImportedFrontmatter('title: Document\ntags:\n  - paper')).toEqual({
      tags: ['paper'],
      title: 'Document'
    });
    expect(unquoteImportedYamlValue("'John''s note'")).toBe("John's note");
  });

  it('formats imported tags and file-derived defaults', () => {
    expect(formatImportedTags([' writing ', '', 'paper'])).toBe('writing, paper');
    expect(getImportTitleFromFile({ name: 'launch-note.md' })).toBe('launch note');
    expect(getImportedSlug('', 'Launch note')).toBe('launch-note');
  });
});

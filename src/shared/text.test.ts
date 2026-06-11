import { describe, expect, it } from 'vitest';

import {
  capitalize,
  cleanAiDescription,
  cleanAiTitle,
  dedupeFileName,
  escapeRegExp,
  getFileExtension,
  parseTags,
  quoteYaml,
  sanitizeFileName,
  slugify,
  stripMarkdown
} from './text';

describe('text helpers', () => {
  it('creates stable slugs from prose', () => {
    expect(slugify(' Café au lait & gâteau! ')).toBe('cafe-au-lait-gateau');
    expect(slugify('a'.repeat(100))).toHaveLength(80);
  });

  it('normalizes file names and extensions', () => {
    expect(sanitizeFileName(' Hero Shot.JPG ')).toBe('hero-shot.jpg');
    expect(sanitizeFileName('???')).toBe('image.png');
    expect(getFileExtension('Banner.PNG?cache=1')).toBe('.pngcache1');
  });

  it('deduplicates file names without changing the first available name', () => {
    expect(dedupeFileName('image.png', ['cover.png'])).toBe('image.png');
    expect(dedupeFileName('image.png', ['image.png', 'image-2.png'])).toBe('image-3.png');
  });

  it('formats tags and YAML-safe values for export', () => {
    expect(parseTags('Product Launch, Deja Vu, , UI')).toEqual(['product-launch', 'deja-vu', 'ui']);
    expect(quoteYaml('A "quoted"\nvalue')).toBe('"A \\"quoted\\" value"');
  });

  it('cleans markdown and AI field suggestions', () => {
    expect(stripMarkdown('# Title\n![Alt](image.png)\nRead [the document](https://example.com).')).toBe('Title Read the document.');
    expect(cleanAiTitle('Document title: "A launch note"')).toBe('A launch note');
    expect(cleanAiDescription('- A compact\nsummary')).toBe('A compact summary');
  });

  it('handles small string utilities', () => {
    expect(capitalize('paper')).toBe('Paper');
    expect(escapeRegExp('a+b?')).toBe('a\\+b\\?');
  });
});

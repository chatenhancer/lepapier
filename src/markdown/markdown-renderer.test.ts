import { describe, expect, it } from 'vitest';

import {
  findRenderedSelectionInSource,
  renderMarkdown
} from './markdown-renderer';

describe('renderMarkdown', () => {
  it('renders inline formatting used by preview toolbar actions', () => {
    const html = renderMarkdown('This is *italic*, **bold**, ~~gone~~, `code`, and [a link](https://example.com).');

    expect(html).toContain('<em>italic</em>');
    expect(html).toContain('<strong>bold</strong>');
    expect(html).toContain('<s>gone</s>');
    expect(html).toContain('<code>code</code>');
    expect(html).toContain('<a href="https://example.com">a link</a>');
  });

  it('renders ordered lists, task lists, horizontal rules, and tables', () => {
    const html = renderMarkdown([
      '1. First',
      '2. Second',
      '',
      '- [x] Done',
      '- [ ] Next',
      '',
      '---',
      '',
      '| Name | Count |',
      '| :--- | ---: |',
      '| Paper | 3 |'
    ].join('\n'));

    expect(html).toContain('<ol>');
    expect(html).toContain('data-list-marker="1. "');
    expect(html).toContain('<input type="checkbox" checked disabled aria-label="Completed task">');
    expect(html).toContain('<input type="checkbox" disabled aria-label="Open task">');
    expect(html).toContain('<hr>');
    expect(html).toContain('<div class="preview-table-scroll" data-table-start="48" data-table-end="94"><table>');
    expect(html).toContain('<th data-table-row="0" data-table-column="0" data-align="left" data-source-start="50" data-source-end="54">Name</th>');
    expect(html).toContain('<th data-table-row="0" data-table-column="1" data-align="right" data-source-start="57" data-source-end="62">Count</th>');
    expect(html).toContain('<td data-table-row="1" data-table-column="0" data-align="left" data-source-start="83" data-source-end="88">Paper</td>');
    expect(html).toContain('<td data-table-row="1" data-table-column="1" data-align="right" data-source-start="91" data-source-end="92">3</td>');
  });

  it('renders table cells with source positions for preview editing', () => {
    const html = renderMarkdown([
      '| Name | Count |',
      '| --- | ---: |',
      '| Paper | 3 |'
    ].join('\n'));

    expect(html).toContain('<th data-table-row="0" data-table-column="0" data-source-start="2" data-source-end="6">Name</th>');
    expect(html).toContain('<td data-table-row="1" data-table-column="1" data-align="right" data-source-start="42" data-source-end="43">3</td>');
  });

  it('maps rendered selections through list and strikethrough markers', () => {
    expect(findRenderedSelectionInSource('1. First', 'First', 0, 5)).toEqual({
      end: 8,
      start: 3
    });
    expect(findRenderedSelectionInSource('- [x] Done', 'Done', 0, 4)).toEqual({
      end: 10,
      start: 6
    });
    expect(findRenderedSelectionInSource('~~gone~~', 'gone', 0, 4)).toEqual({
      end: 6,
      start: 2
    });
  });

  it('renders media side text with relative source positions for preview formatting', () => {
    const html = renderMarkdown([
      ':::media-right',
      '',
      '![Alt](hero.png)',
      '',
      'Side copy',
      '',
      ':::'
    ].join('\n'));

    expect(html).toContain('data-media-copy data-media-index="0"');
    expect(html).toContain('<p data-source-start="0" data-source-end="9">Side copy</p>');
  });

  it('renders preview image tooltips through the app tooltip layer', () => {
    const html = renderMarkdown('![Alt](hero.png){align=center crop=1.2 shadow=smooth}');

    expect(html).not.toContain(' title=');
    expect(html).toContain('data-tooltip="Click to select. Paste to replace, Delete to remove."');
    expect(html).toContain('data-image-align-center aria-pressed="true" data-tooltip="Stop centering image"');
    expect(html).toContain('data-image-crop-toggle aria-pressed="true" data-tooltip="Turn off crop"');
    expect(html).toContain('data-image-shadow-toggle aria-pressed="true" data-tooltip="Remove image shadow"');
    expect(html).toContain('data-tooltip="Drag to resize image"');
    expect(html).toContain('data-tooltip="Drag to change crop height"');
  });
});

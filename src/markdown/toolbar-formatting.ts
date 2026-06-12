import {
  toggleHeadingBlock,
  toggleLinePrefix,
  toggleMarkdownLink,
  toggleMarkdownWrapper,
  toggleOrderedLinePrefix,
  toggleTaskLinePrefix
} from './markdown-editing';

export interface MarkdownSourceSelection {
  absoluteEnd: number;
  absoluteStart: number;
  body: string;
  sourceEnd: number;
  sourceStart: number;
}

export function createToolbarFormattingSnippet(type: string, selected: string): string {
  const snippets: Record<string, string> = {
    bold: `**${selected || 'bold text'}**`,
    code: selected.includes('\n') ? `\`\`\`\n${selected || 'code'}\n\`\`\`` : `\`${selected || 'code'}\``,
    heading: `## ${selected || 'Section heading'}`,
    image: `![${selected || 'Alt text'}](image.png)`,
    italic: `*${selected || 'italic text'}*`,
    link: `[${selected || 'Link text'}](https://example.com)`,
    list: selected ? selected.split('\n').map((line) => `- ${line}`).join('\n') : '- List item',
    'ordered-list': selected ? selected.split('\n').map((line, index) => `${index + 1}. ${line}`).join('\n') : '1. List item',
    quote: selected ? selected.split('\n').map((line) => `> ${line}`).join('\n') : '> Quote',
    rule: '\n\n---\n\n',
    strike: `~~${selected || 'removed text'}~~`,
    table: [
      '',
      '',
      '| Column | Value |',
      '| --- | --- |',
      '| Item | Detail |',
      ''
    ].join('\n'),
    'task-list': selected ? selected.split('\n').map((line) => `- [ ] ${line}`).join('\n') : '- [ ] Task'
  };

  return snippets[type] || selected;
}

export function applyToolbarFormattingToSource(type: string, selection: MarkdownSourceSelection): string | null {
  const {
    absoluteEnd,
    absoluteStart,
    body,
    sourceEnd,
    sourceStart
  } = selection;

  if (type === 'bold') return toggleMarkdownWrapper(body, absoluteStart, absoluteEnd, '**');
  if (type === 'italic') return toggleMarkdownWrapper(body, absoluteStart, absoluteEnd, '*');
  if (type === 'strike') return toggleMarkdownWrapper(body, absoluteStart, absoluteEnd, '~~');
  if (type === 'code') return toggleMarkdownWrapper(body, absoluteStart, absoluteEnd, '`');
  if (type === 'link') return toggleMarkdownLink(body, absoluteStart, absoluteEnd);
  if (type === 'heading') return toggleHeadingBlock(body, sourceStart, sourceEnd);
  if (type === 'quote') return toggleLinePrefix(body, sourceStart, sourceEnd, '> ');
  if (type === 'list') return toggleLinePrefix(body, sourceStart, sourceEnd, '- ');
  if (type === 'ordered-list') return toggleOrderedLinePrefix(body, sourceStart, sourceEnd);
  if (type === 'task-list') return toggleTaskLinePrefix(body, sourceStart, sourceEnd);
  if (type === 'rule') return `${body.slice(0, sourceStart)}---${body.slice(sourceEnd)}`;
  return null;
}

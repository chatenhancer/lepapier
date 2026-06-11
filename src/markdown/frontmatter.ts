import { slugify } from '../shared/text';

export interface ImportedMarkdown {
  body: string;
  frontmatter: Record<string, string | string[]>;
  frontmatterExtras: string[];
}

export function parseImportedMarkdown(source: string): ImportedMarkdown {
  const frontmatterMatch = /^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/.exec(source);
  if (!frontmatterMatch) {
    return {
      body: source,
      frontmatter: {},
      frontmatterExtras: []
    };
  }

  const frontmatterSource = frontmatterMatch[1];
  return {
    body: source.slice(frontmatterMatch[0].length),
    frontmatter: parseImportedFrontmatter(frontmatterSource),
    frontmatterExtras: getImportedExtraFrontmatterLines(frontmatterSource)
  };
}

export function parseImportedFrontmatter(source: string): Record<string, string | string[]> {
  const data: Record<string, string | string[]> = {};
  let listKey = '';

  for (const rawLine of String(source || '').split('\n')) {
    const line = rawLine.trimEnd();
    const listMatch = /^\s*-\s+(.+)$/.exec(line);
    const currentList = data[listKey];
    if (listKey && listMatch && Array.isArray(currentList)) {
      const value = unquoteImportedYamlValue(listMatch[1]);
      currentList.push(Array.isArray(value) ? value.join(', ') : value);
      continue;
    }

    const fieldMatch = /^([A-Za-z0-9_-]+):(?:\s*(.*))?$/.exec(line);
    if (!fieldMatch) {
      listKey = '';
      continue;
    }

    const [, key, rawValue = ''] = fieldMatch;
    const value = rawValue.trim();
    if (!value) {
      data[key] = [];
      listKey = key;
      continue;
    }

    data[key] = unquoteImportedYamlValue(value);
    listKey = '';
  }

  return data;
}

export function getImportedExtraFrontmatterLines(source: string): string[] {
  const knownKeys = new Set(['date', 'description', 'image', 'slug', 'tags', 'title']);
  const lines: string[] = [];
  let shouldKeepBlock = false;

  for (const rawLine of String(source || '').split('\n')) {
    const line = rawLine.trimEnd();
    const fieldMatch = /^([A-Za-z0-9_-]+):/.exec(line);
    if (fieldMatch) {
      shouldKeepBlock = !knownKeys.has(fieldMatch[1]);
    }

    if (shouldKeepBlock && line.trim()) {
      lines.push(line);
    }
  }

  return lines;
}

export function unquoteImportedYamlValue(value: string): string | string[] {
  const trimmed = String(value || '').trim();
  if (trimmed === '[]') return [];
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.slice(1, -1);
    }
  }
  if (trimmed.startsWith('\'') && trimmed.endsWith('\'')) {
    return trimmed.slice(1, -1).replace(/''/g, '\'');
  }
  return trimmed;
}

export function formatImportedTags(value: string | string[]): string {
  if (Array.isArray(value)) return value.map((tag) => String(tag).trim()).filter(Boolean).join(', ');
  return String(value || '');
}

export function getImportTitleFromFile(file: Pick<File, 'name'>): string {
  return file.name
    .replace(/\.md$/i, '')
    .replace(/[-_]+/g, ' ')
    .trim() || 'Untitled document';
}

export function getImportedSlug(frontmatterSlug: unknown, title: string): string {
  return String(frontmatterSlug || '').trim() || slugify(title);
}

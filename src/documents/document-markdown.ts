import type { MediaAsset, DocumentRecord } from '../shared/types';
import { getToday } from '../shared/date';
import {
  dedupeFileName,
  getFileExtension,
  parseTags,
  quoteYaml,
  slugify
} from '../shared/text';

export type AssetPathMap = Map<string, string>;

export interface BuildDocumentMarkdownOptions {
  assetPathMap?: AssetPathMap;
  documentRecord: DocumentRecord;
}

export function buildDocumentMarkdown({
  assetPathMap = new Map(),
  documentRecord
}: BuildDocumentMarkdownOptions): string {
  const title = getDocumentFieldValue(documentRecord, 'title') || 'Untitled document';
  const slug = getDocumentFieldValue(documentRecord, 'slug') || slugify(title) || 'untitled-document';
  const date = getDocumentFieldValue(documentRecord, 'date') || getToday();
  const description = getDocumentFieldValue(documentRecord, 'description');
  const image = getMappedAssetPath(getDocumentFieldValue(documentRecord, 'image'), assetPathMap);
  const tags = parseTags(getDocumentFieldValue(documentRecord, 'tags'));
  const body = rewriteMarkdownAssetPaths(getDocumentFieldValue(documentRecord, 'body').trim(), assetPathMap);
  const frontmatter = [
    '---',
    `title: ${quoteYaml(title)}`,
    `date: ${date}`,
    `description: ${quoteYaml(description)}`,
    `slug: ${quoteYaml(slug)}`
  ];

  if (image) {
    frontmatter.push(`image: ${quoteYaml(image)}`);
  }

  for (const line of documentRecord.frontmatterExtras || []) {
    if (line.trim()) {
      frontmatter.push(line);
    }
  }

  if (tags.length) {
    frontmatter.push('tags:');
    for (const tag of tags) {
      frontmatter.push(`  - ${quoteYaml(tag)}`);
    }
  } else {
    frontmatter.push('tags: []');
  }

  frontmatter.push('---');
  return `${frontmatter.join('\n')}\n\n${body}\n`;
}

export function getDocumentFieldValue(documentRecord: DocumentRecord | null | undefined, name: keyof DocumentRecord['fields']): string {
  return documentRecord?.fields?.[name]?.trim?.() || '';
}

export function getDocumentFolderName(documentRecord: DocumentRecord): string {
  const date = getDocumentFieldValue(documentRecord, 'date') || getToday();
  const slug = getDocumentSlug(documentRecord);
  return `${date}-${slug}`;
}

export function getDocumentMarkdownPath(documentRecord: DocumentRecord): string {
  const sourcePath = normalizeDocumentAssetPath(documentRecord.source?.markdownPath);
  if (sourcePath) return ensureMarkdownExtension(sourcePath);

  return `${getDocumentFolderName(documentRecord)}.md`;
}

export function getDocumentSlug(documentRecord: DocumentRecord): string {
  return getDocumentFieldValue(documentRecord, 'slug') || slugify(getDocumentFieldValue(documentRecord, 'title')) || 'untitled-document';
}

export function dedupeFolderName(folderName: string, usedFolders: Set<string>): string {
  let candidate = folderName;
  let index = 2;
  while (usedFolders.has(candidate)) {
    candidate = `${folderName}-${index}`;
    index += 1;
  }
  return candidate;
}

export function createExportAssetPathMap(
  assets: MediaAsset[],
  { randomize = false }: { randomize?: boolean } = {}
): AssetPathMap {
  const localPathMap = randomize ? createRandomizedAssetPathMap(assets) : new Map<string, string>();
  const map: AssetPathMap = new Map();

  for (const asset of assets) {
    const fileName = localPathMap.get(asset.path) || asset.name;
    addAssetPathAliases(map, asset, `./${fileName}`);
  }

  return map;
}

export function createEditableFolderAssetPathMap(assets: MediaAsset[], markdownPath = 'index.md'): AssetPathMap {
  const map: AssetPathMap = new Map();
  for (const asset of assets) {
    const sourcePath = normalizeDocumentAssetPath(asset.sourcePath || asset.path);
    addAssetPathAliases(map, asset, getRelativeMarkdownPath(markdownPath, sourcePath));
  }
  return map;
}

export function getReferencedBodyAssetPaths(documentRecord: DocumentRecord): Set<string> {
  const paths = new Set<string>();
  const body = getDocumentFieldValue(documentRecord, 'body');
  const imagePattern = /!\[[^\]]*]\(([^)]+)\)/g;

  for (const match of body.matchAll(imagePattern)) {
    const path = match[1].trim();
    if (isImportableAssetReference(path)) {
      paths.add(path);
    }
  }

  return paths;
}

export function getMappedAssetPath(path: string, assetPathMap: AssetPathMap): string {
  return assetPathMap.get(path) || path;
}

export function rewriteMarkdownAssetPaths(markdown: string, assetPathMap: AssetPathMap): string {
  if (!assetPathMap.size) return markdown;

  return markdown.replace(/(!\[[^\]]*]\()([^)]+)(\)(?:\{[^}]*\})?)/g, (match, prefix, path, suffix) => {
    return assetPathMap.has(path) ? `${prefix}${assetPathMap.get(path)}${suffix}` : match;
  });
}

export function normalizeDocumentAssetPath(path: string | undefined): string {
  const normalized = String(path || '')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
  return normalizePathSegments(normalized);
}

export function isImportableAssetReference(path: string): boolean {
  const trimmed = String(path || '').trim();
  return Boolean(trimmed)
    && !/^(?:[a-z][a-z0-9+.-]*:)?\/\//i.test(trimmed)
    && !/^(?:data|mailto|tel):/i.test(trimmed);
}

function createRandomizedAssetPathMap(assets: MediaAsset[]): Map<string, string> {
  const map = new Map<string, string>();
  const usedNames = new Set<string>();
  for (const asset of assets) {
    const randomizedName = createRandomizedAssetFileName(asset.name, usedNames);
    map.set(asset.path, randomizedName);
    usedNames.add(randomizedName);
  }
  return map;
}

function addAssetPathAliases(map: AssetPathMap, asset: MediaAsset, outputPath: string): void {
  for (const candidate of [asset.path, asset.sourcePath]) {
    const alias = normalizeDocumentAssetPath(candidate);
    if (!alias) continue;

    map.set(alias, outputPath);
    map.set(`./${alias}`, outputPath);
  }
}

export function getRelativeMarkdownPath(markdownPath: string, targetPath: string): string {
  const markdownDirectory = getPathDirectory(normalizeDocumentAssetPath(markdownPath));
  const target = normalizeDocumentAssetPath(targetPath);
  const relativePath = getRelativePath(markdownDirectory, target);
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
}

export function getPathBasename(path: string): string {
  const normalized = normalizeDocumentAssetPath(path);
  return normalized.split('/').filter(Boolean).pop() || '';
}

export function getPathDirectory(path: string): string {
  const normalized = normalizeDocumentAssetPath(path);
  const slashIndex = normalized.lastIndexOf('/');
  return slashIndex >= 0 ? normalized.slice(0, slashIndex) : '';
}

function ensureMarkdownExtension(path: string): string {
  return /\.md$/i.test(path) ? path : `${path}.md`;
}

function getRelativePath(fromDirectory: string, targetPath: string): string {
  const fromParts = normalizeDocumentAssetPath(fromDirectory).split('/').filter(Boolean);
  const targetParts = normalizeDocumentAssetPath(targetPath).split('/').filter(Boolean);
  let sharedIndex = 0;

  while (
    sharedIndex < fromParts.length
    && sharedIndex < targetParts.length
    && fromParts[sharedIndex] === targetParts[sharedIndex]
  ) {
    sharedIndex += 1;
  }

  const upwardParts = fromParts.slice(sharedIndex).map(() => '..');
  const downwardParts = targetParts.slice(sharedIndex);
  const relativeParts = [...upwardParts, ...downwardParts];
  return relativeParts.join('/') || getPathBasename(targetPath);
}

function normalizePathSegments(path: string): string {
  const output: string[] = [];
  for (const part of String(path || '').replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (output.length && output[output.length - 1] !== '..') {
        output.pop();
      } else {
        output.push(part);
      }
      continue;
    }
    output.push(part);
  }
  return output.join('/');
}

function createRandomizedAssetFileName(fileName: string, usedNames: Set<string>): string {
  const extension = getFileExtension(fileName);
  let name = '';
  do {
    name = `${createShortRandomId()}${extension}`;
  } while (usedNames.has(name));
  return dedupeFileName(name, Array.from(usedNames));
}

function createShortRandomId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

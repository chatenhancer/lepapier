import type { ImageAsset } from '../shared/types';
import {
  dedupeFileName,
  sanitizeFileName
} from '../shared/text';
import {
  type AssetPathMap,
  isImportableAssetReference
} from './document-markdown';

export interface CreateDocumentImportPlanOptions {
  assetRegistry?: ImportedAssetRegistry;
  body: string;
  createAssetId: () => string;
  existingAssetNames: string[];
  files: File[];
  frontmatter: Record<string, string | string[]>;
  getFilePath: (file: File) => string;
  markdownFile: File;
}

export interface ImportedAssetRegistry {
  fileAssets: Map<File, ImageAsset>;
  pathAssets: Map<string, ImageAsset>;
  usedNames: Set<string>;
}

export interface CreateImportAssetRegistryOptions {
  existingAssetNames?: string[];
  existingAssets?: ImageAsset[];
}

export interface DocumentImportPlan {
  assetPathMap: AssetPathMap;
  assets: ImageAsset[];
  coverImage: ImageAsset | null;
  images: ImageAsset[];
}

export function createImportAssetRegistry({
  existingAssetNames = [],
  existingAssets = []
}: CreateImportAssetRegistryOptions = {}): ImportedAssetRegistry {
  const registry: ImportedAssetRegistry = {
    fileAssets: new Map(),
    pathAssets: new Map(),
    usedNames: new Set(existingAssetNames.filter(Boolean))
  };

  for (const asset of existingAssets) {
    if (asset.name) registry.usedNames.add(asset.name);
    registerImportedAssetPath(asset, registry);
  }

  return registry;
}

export function createDocumentImportPlan({
  assetRegistry,
  body,
  createAssetId,
  existingAssetNames,
  files,
  frontmatter,
  getFilePath,
  markdownFile
}: CreateDocumentImportPlanOptions): DocumentImportPlan {
  const imageFiles = files.filter(isImportImageFile);
  const fileIndex = createImportFileIndex(imageFiles, getFilePath);
  const assetPathMap: AssetPathMap = new Map();
  const registry = assetRegistry || createImportAssetRegistry({ existingAssetNames });
  for (const name of existingAssetNames) {
    if (name) registry.usedNames.add(name);
  }
  const createdAssets = new Set<ImageAsset>();
  const bodyImages = new Set<ImageAsset>();

  let importedCoverImage: ImageAsset | null = null;
  const imageReference = String(frontmatter.image || '').trim();
  if (imageReference) {
    const imageFile = resolveImportFileForReference(imageReference, fileIndex, markdownFile, getFilePath);
    if (imageFile) {
      const { asset, created } = getOrCreateImportedAsset(imageFile, imageReference, registry, createAssetId, getFilePath);
      if (created) createdAssets.add(asset);
      importedCoverImage = asset;
      addImportedAssetPathAlias(assetPathMap, imageReference, importedCoverImage.path);
    }
  }

  for (const imageReference of getImportedMarkdownImageReferences(body)) {
    const imageFile = resolveImportFileForReference(imageReference, fileIndex, markdownFile, getFilePath);
    if (!imageFile) continue;

    const { asset, created } = getOrCreateImportedAsset(imageFile, imageReference, registry, createAssetId, getFilePath);
    if (created) createdAssets.add(asset);
    if (asset !== importedCoverImage) bodyImages.add(asset);
    addImportedAssetPathAlias(assetPathMap, imageReference, asset.path);
  }

  return {
    assetPathMap,
    assets: Array.from(createdAssets),
    coverImage: importedCoverImage,
    images: Array.from(bodyImages)
  };
}

export function findImportMarkdownFile(files: File[]): File | null {
  const markdownFiles = getImportMarkdownFiles(files);
  return markdownFiles.find((file) => file.name.toLowerCase() === 'index.md') || markdownFiles[0] || null;
}

export function getImportMarkdownFiles(files: File[]): File[] {
  return files
    .filter((file) => /\.md$/i.test(file.name) || file.type === 'text/markdown')
    .sort((first, second) => first.name.localeCompare(second.name));
}

export function rewriteImportedMarkdownAssetPaths(markdown: string, assetPathMap: AssetPathMap): string {
  if (!assetPathMap.size) return markdown;

  return markdown.replace(/(!\[[^\]]*]\()([^)]+)(\)(?:\{[^}]*\})?)/g, (match, prefix, path, suffix) => {
    const replacement = assetPathMap.get(path) || assetPathMap.get(normalizeImportedAssetReference(path));
    return replacement ? `${prefix}${replacement}${suffix}` : match;
  });
}

export function getImportedMarkdownImageReferences(markdown: string): string[] {
  const references: string[] = [];
  const imagePattern = /!\[[^\]]*]\(([^)]+)\)/g;
  for (const match of String(markdown || '').matchAll(imagePattern)) {
    const reference = match[1].trim();
    if (isImportableAssetReference(reference)) {
      references.push(reference);
    }
  }
  return references;
}

export function normalizeImportedAssetReference(path: string | undefined): string {
  const trimmed = String(path || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .split(/[?#]/)[0];

  return normalizeImportPath(trimmed)
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

export function normalizeImportPath(path: string | undefined): string {
  const output: string[] = [];
  for (const part of String(path || '')
    .replace(/\\/g, '/')
    .replace(/\/+/g, '/')
    .replace(/^\.\//, '')
    .split('/')) {
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

export function isImportImageFile(file: File): boolean {
  return file.type.startsWith('image/') || /\.(?:png|jpe?g|gif|webp|avif|svg)$/i.test(file.name);
}

function createImportFileIndex(files: File[], getFilePath: (file: File) => string): Map<string, File> {
  const index = new Map<string, File>();

  for (const file of files) {
    const path = normalizeImportPath(getFilePath(file));
    if (path && !index.has(path)) {
      index.set(path, file);
    }
  }

  return index;
}

function resolveImportFileForReference(
  reference: string,
  fileIndex: Map<string, File>,
  markdownFile: File,
  getFilePath: (file: File) => string
): File | null {
  if (!isImportableAssetReference(reference)) return null;

  const resolvedReferencePath = getImportReferencePath(reference, markdownFile, getFilePath);
  return fileIndex.get(resolvedReferencePath) || null;
}

function getImportReferencePath(reference: string, markdownFile: File, getFilePath: (file: File) => string): string {
  const referencePath = normalizeImportedAssetReference(reference);
  const markdownPath = normalizeImportPath(getFilePath(markdownFile));
  const slashIndex = markdownPath.lastIndexOf('/');
  const markdownDirectory = slashIndex >= 0 ? markdownPath.slice(0, slashIndex) : '';
  return normalizeImportPath(markdownDirectory ? `${markdownDirectory}/${referencePath}` : referencePath);
}

function getOrCreateImportedAsset(
  file: File,
  reference: string,
  registry: ImportedAssetRegistry,
  createAssetId: () => string,
  getFilePath: (file: File) => string
): { asset: ImageAsset; created: boolean } {
  const referenceFileName = normalizeImportedAssetReference(reference).split('/').pop() || file.name;
  const sourcePath = normalizeImportPath(getFilePath(file) || file.name);
  const existingAsset = registry.fileAssets.get(file) || registry.pathAssets.get(sourcePath);
  if (existingAsset) {
    registry.fileAssets.set(file, existingAsset);
    return { asset: existingAsset, created: false };
  }

  const name = dedupeFileName(sanitizeFileName(referenceFileName), Array.from(registry.usedNames));
  registry.usedNames.add(name);

  const asset = {
    file,
    id: createAssetId(),
    name,
    path: sourcePath || name,
    sourcePath,
    url: URL.createObjectURL(file)
  };
  registry.fileAssets.set(file, asset);
  registerImportedAssetPath(asset, registry);
  return { asset, created: true };
}

function registerImportedAssetPath(asset: ImageAsset, registry: ImportedAssetRegistry): void {
  for (const path of [asset.path, asset.sourcePath]) {
    const key = normalizeImportPath(path || '');
    if (key && !registry.pathAssets.has(key)) {
      registry.pathAssets.set(key, asset);
    }
  }
}

function addImportedAssetPathAlias(assetPathMap: AssetPathMap, reference: string, assetPath: string): void {
  const normalizedReference = normalizeImportedAssetReference(reference);
  assetPathMap.set(reference, assetPath);
  assetPathMap.set(normalizedReference, assetPath);
  assetPathMap.set(`./${normalizedReference}`, assetPath);
}

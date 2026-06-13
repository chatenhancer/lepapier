import {
  buildDocumentMarkdown,
  createEditableFolderAssetPathMap,
  dedupeFolderName,
  getDocumentFolderName,
  getDocumentMarkdownPath,
  getPathBasename,
  getPathDirectory,
  getRelativeMarkdownPath,
  normalizeDocumentAssetPath
} from '../documents/document-markdown';
import { dedupeFileName, getFileExtension } from '../shared/text';
import type { MediaAsset, DocumentRecord, ZipFileEntry } from '../shared/types';

const textEncoder = new TextEncoder();

export type ResolveDocumentAssets = (documentRecords: DocumentRecord[]) => Promise<MediaAsset[]>;
export type ReadAssetData = (asset: MediaAsset) => Promise<Uint8Array<ArrayBuffer>>;

export interface DocumentZipFilesOptions {
  documentRecord: DocumentRecord;
  folderName?: string;
  randomizeMediaNames?: boolean;
  readAssetData?: ReadAssetData;
  resolveAssets: ResolveDocumentAssets;
}

export interface DocumentCollectionZipFilesOptions {
  documentRecords: DocumentRecord[];
  randomizeMediaNames?: boolean;
  resolveAssets: ResolveDocumentAssets;
}

export interface EditableFolderFilesOptions {
  documentRecord: DocumentRecord;
  randomizeMediaNames?: boolean;
  readAssetData: ReadAssetData;
  resolveAssets: ResolveDocumentAssets;
}

export interface PortableDocumentFilesOptions {
  documentRecords: DocumentRecord[];
  randomizeMediaNames?: boolean;
  readAssetData?: ReadAssetData;
  resolveAssets: ResolveDocumentAssets;
}

export async function createDocumentZipFilesForDocument({
  documentRecord,
  folderName = getDocumentFolderName(documentRecord),
  randomizeMediaNames = false,
  readAssetData = readFileAssetData,
  resolveAssets
}: DocumentZipFilesOptions): Promise<ZipFileEntry[]> {
  const assetFiles = await resolveAssets([documentRecord]);
  const getAssetData = createCachedAssetDataReader(readAssetData);
  const assetOutputPathMap = await createDocumentZipAssetOutputPathMap(assetFiles, {
    randomizeMediaNames,
    readAssetData: getAssetData
  });
  const files: ZipFileEntry[] = [{
    data: textEncoder.encode(buildDocumentMarkdown({
      assetPathMap: createDocumentZipAssetPathMap(assetFiles, assetOutputPathMap),
      documentRecord
    })),
    path: `${folderName}/index.md`
  }];

  for (const asset of assetFiles) {
    const assetPath = assetOutputPathMap.get(asset) || asset.name;
    files.push({
      data: await getAssetData(asset),
      path: `${folderName}/${assetPath}`
    });
  }

  return files;
}

export async function createDocumentCollectionZipFiles({
  documentRecords,
  randomizeMediaNames = false,
  resolveAssets
}: DocumentCollectionZipFilesOptions): Promise<ZipFileEntry[]> {
  const usedFolders = new Set<string>();
  const files: ZipFileEntry[] = [];

  for (const documentRecord of documentRecords) {
    const folderName = dedupeFolderName(getDocumentFolderName(documentRecord), usedFolders);
    usedFolders.add(folderName);
    files.push(...await createDocumentZipFilesForDocument({
      documentRecord,
      folderName,
      randomizeMediaNames,
      resolveAssets
    }));
  }

  return files;
}

export async function createPortableDocumentFiles({
  documentRecords,
  randomizeMediaNames = false,
  readAssetData = readFileAssetData,
  resolveAssets
}: PortableDocumentFilesOptions): Promise<ZipFileEntry[]> {
  const usedMarkdownPaths = new Set<string>();
  const usedAssetPaths = new Set<string>();
  const assignedAssetPaths = new Map<string, string>();
  const getAssetData = createCachedAssetDataReader(readAssetData);
  const files: ZipFileEntry[] = [];

  for (const documentRecord of documentRecords) {
    const markdownPath = dedupeFilePath(getDocumentMarkdownPath(documentRecord), usedMarkdownPaths);
    usedMarkdownPaths.add(markdownPath);
    const assetFiles = await resolveAssets([documentRecord]);

    if (documentRecord.source?.mode === 'editable-file') {
      files.push({
        data: textEncoder.encode(buildDocumentMarkdown({
          assetPathMap: await createEmbeddedAssetPathMap(assetFiles, readAssetData),
          documentRecord
        })),
        path: markdownPath
      });
      continue;
    }

    const assetOutputPathMap = await createPortableAssetOutputPathMap(assetFiles, {
      assignedAssetPaths,
      markdownPath,
      randomizeMediaNames,
      readAssetData: getAssetData,
      usedAssetPaths,
      useSourcePaths: documentRecord.source?.mode === 'folder' || documentRecord.source?.mode === 'editable-folder'
    });

    files.push({
      data: textEncoder.encode(buildDocumentMarkdown({
        assetPathMap: createPortableAssetPathMap(assetFiles, markdownPath, assetOutputPathMap),
        documentRecord
      })),
      path: markdownPath
    });

    for (const asset of assetFiles) {
      const assetPath = assetOutputPathMap.get(asset);
      if (!assetPath) continue;
      files.push({
        data: await getAssetData(asset),
        path: assetPath
      });
    }
  }

  return dedupeZipEntries(files);
}

export async function createEditableFolderDocumentFiles({
  documentRecord,
  randomizeMediaNames = false,
  readAssetData,
  resolveAssets
}: EditableFolderFilesOptions): Promise<ZipFileEntry[]> {
  const assetFiles = await resolveAssets([documentRecord]);
  const markdownPath = getDocumentMarkdownPath(documentRecord);
  const getAssetData = createCachedAssetDataReader(readAssetData);
  const assetOutputPathMap = await createEditableFolderAssetOutputPathMap(assetFiles, {
    randomizeMediaNames,
    readAssetData: getAssetData
  });
  const assetPathMap = createEditableFolderAssetPathMap(assetFiles, markdownPath, {
    assetOutputPathMap
  });
  const files: ZipFileEntry[] = [{
    data: textEncoder.encode(buildDocumentMarkdown({ assetPathMap, documentRecord })),
    path: markdownPath
  }];

  for (const asset of assetFiles) {
    files.push({
      data: await getAssetData(asset),
      path: assetOutputPathMap.get(asset) || normalizeDocumentAssetPath(asset.sourcePath || asset.path)
    });
  }

  return files;
}

export async function createEditableFileDocumentFile({
  documentRecord,
  readAssetData,
  resolveAssets
}: EditableFolderFilesOptions): Promise<ZipFileEntry> {
  const assetFiles = await resolveAssets([documentRecord]);
  return {
    data: textEncoder.encode(buildDocumentMarkdown({
      assetPathMap: await createEmbeddedAssetPathMap(assetFiles, readAssetData),
      documentRecord
    })),
    path: getDocumentMarkdownPath(documentRecord)
  };
}

async function readFileAssetData(asset: MediaAsset): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await asset.file.arrayBuffer());
}

async function createPortableAssetOutputPathMap(
  assets: MediaAsset[],
  {
    assignedAssetPaths,
    markdownPath,
    randomizeMediaNames,
    readAssetData,
    usedAssetPaths,
    useSourcePaths
  }: {
    assignedAssetPaths: Map<string, string>;
    markdownPath: string;
    randomizeMediaNames: boolean;
    readAssetData: ReadAssetData;
    usedAssetPaths: Set<string>;
    useSourcePaths: boolean;
  }
): Promise<Map<MediaAsset, string>> {
  const map = new Map<MediaAsset, string>();
  const markdownBase = getFileStem(getPathBasename(markdownPath)) || 'document';
  const assetDirectory = normalizeDocumentAssetPath(`${getPathDirectory(markdownPath)}/${markdownBase}-assets`);
  const usedNames = new Set<string>();

  for (const asset of assets) {
    const assetKey = getAssetOutputKey(asset);
    const assignedPath = assignedAssetPaths.get(assetKey);
    if (assignedPath) {
      map.set(asset, assignedPath);
      continue;
    }

    const sourcePath = normalizeDocumentAssetPath(asset.sourcePath);
    const preferredPath = randomizeMediaNames
      ? normalizeDocumentAssetPath(`${assetDirectory}/${await createContentHashAssetFileName(asset.name, await readAssetData(asset), usedNames)}`)
      : useSourcePaths && sourcePath
      ? sourcePath
      : normalizeDocumentAssetPath(`${assetDirectory}/${getOriginalAssetFileName(asset, usedNames)}`);
    const outputPath = dedupeFilePath(preferredPath || asset.name, usedAssetPaths);
    usedAssetPaths.add(outputPath);
    assignedAssetPaths.set(assetKey, outputPath);
    map.set(asset, outputPath);
  }

  return map;
}

function getAssetOutputKey(asset: MediaAsset): string {
  return normalizeDocumentAssetPath(asset.sourcePath || asset.path || asset.name);
}

async function createDocumentZipAssetOutputPathMap(
  assets: MediaAsset[],
  {
    randomizeMediaNames,
    readAssetData
  }: {
    randomizeMediaNames: boolean;
    readAssetData: ReadAssetData;
  }
): Promise<Map<MediaAsset, string>> {
  const map = new Map<MediaAsset, string>();
  const usedNames = new Set<string>();

  for (const asset of assets) {
    const fileName = randomizeMediaNames
      ? await createContentHashAssetFileName(asset.name, await readAssetData(asset), usedNames)
      : getOriginalAssetFileName(asset, usedNames);
    usedNames.add(fileName);
    map.set(asset, fileName);
  }

  return map;
}

function createDocumentZipAssetPathMap(
  assets: MediaAsset[],
  assetOutputPathMap: Map<MediaAsset, string>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const asset of assets) {
    const outputPath = assetOutputPathMap.get(asset);
    if (!outputPath) continue;
    addAssetPathAliases(map, asset, `./${outputPath}`);
  }
  return map;
}

async function createEditableFolderAssetOutputPathMap(
  assets: MediaAsset[],
  {
    randomizeMediaNames,
    readAssetData
  }: {
    randomizeMediaNames: boolean;
    readAssetData: ReadAssetData;
  }
): Promise<Map<MediaAsset, string>> {
  const map = new Map<MediaAsset, string>();
  const usedNames = new Set<string>();
  const usedPaths = new Set<string>();

  for (const asset of assets) {
    const sourcePath = normalizeDocumentAssetPath(asset.sourcePath || asset.path || asset.name);
    if (!randomizeMediaNames) {
      map.set(asset, sourcePath);
      continue;
    }

    const directory = getPathDirectory(sourcePath);
    const randomizedName = await createContentHashAssetFileName(asset.name, await readAssetData(asset), usedNames);
    const randomizedPath = normalizeDocumentAssetPath(`${directory}/${randomizedName}`);
    const outputPath = dedupeFilePath(randomizedPath, usedPaths);
    usedNames.add(getPathBasename(outputPath));
    usedPaths.add(outputPath);
    map.set(asset, outputPath);
  }

  return map;
}

function createPortableAssetPathMap(
  assets: MediaAsset[],
  markdownPath: string,
  assetOutputPathMap: Map<MediaAsset, string>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const asset of assets) {
    const outputPath = assetOutputPathMap.get(asset);
    if (!outputPath) continue;
    addAssetPathAliases(map, asset, getRelativeMarkdownPath(markdownPath, outputPath));
  }
  return map;
}

async function createEmbeddedAssetPathMap(
  assets: MediaAsset[],
  readAssetData: ReadAssetData
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const asset of assets) {
    addAssetPathAliases(map, asset, `data:${asset.file.type || 'application/octet-stream'};base64,${toBase64(await readAssetData(asset))}`);
  }
  return map;
}

function addAssetPathAliases(map: Map<string, string>, asset: MediaAsset, outputPath: string): void {
  for (const candidate of [asset.path, asset.sourcePath]) {
    const alias = normalizeDocumentAssetPath(candidate);
    if (!alias) continue;
    map.set(alias, outputPath);
    map.set(`./${alias}`, outputPath);
  }
}

function dedupeZipEntries(files: ZipFileEntry[]): ZipFileEntry[] {
  const entries = new Map<string, ZipFileEntry>();
  for (const file of files) {
    entries.set(file.path, file);
  }
  return Array.from(entries.values());
}

function dedupeFilePath(path: string, usedPaths: Set<string>): string {
  const normalized = normalizeDocumentAssetPath(path);
  if (!usedPaths.has(normalized)) return normalized;

  const directory = getPathDirectory(normalized);
  const basename = getPathBasename(normalized);
  const extension = getFileExtension(basename);
  const stem = getFileStem(basename);
  let index = 2;
  let candidate = '';
  do {
    candidate = normalizeDocumentAssetPath(`${directory}/${stem}-${index}${extension}`);
    index += 1;
  } while (usedPaths.has(candidate));
  return candidate;
}

function getOriginalAssetFileName(asset: MediaAsset, usedNames: Set<string>): string {
  const deduped = dedupeFileName(asset.name, Array.from(usedNames));
  usedNames.add(deduped);
  return deduped;
}

async function createContentHashAssetFileName(
  fileName: string,
  bytes: Uint8Array<ArrayBuffer>,
  usedNames: Set<string>
): Promise<string> {
  const name = `${(await createSha256Hex(bytes)).slice(0, 16)}${getFileExtension(fileName)}`;
  return dedupeFileName(name, Array.from(usedNames));
}

async function createSha256Hex(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function createCachedAssetDataReader(readAssetData: ReadAssetData): ReadAssetData {
  const cache = new Map<MediaAsset, Promise<Uint8Array<ArrayBuffer>>>();
  return async (asset) => {
    const cached = cache.get(asset);
    if (cached) return await cached;

    const dataPromise = readAssetData(asset);
    cache.set(asset, dataPromise);
    return await dataPromise;
  };
}

function getFileStem(fileName: string): string {
  const dotIndex = fileName.lastIndexOf('.');
  return dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
}

function toBase64(bytes: Uint8Array<ArrayBuffer>): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.slice(index, index + chunkSize));
  }
  return btoa(binary);
}

import {
  buildDocumentMarkdown,
  createEditableFolderAssetPathMap,
  createExportAssetPathMap,
  dedupeFolderName,
  getMappedAssetPath,
  getDocumentFolderName,
  getDocumentMarkdownPath,
  getPathBasename,
  getPathDirectory,
  getRelativeMarkdownPath,
  normalizeDocumentAssetPath
} from '../documents/document-markdown';
import { dedupeFileName, getFileExtension } from '../shared/text';
import type { ImageAsset, DocumentRecord, ZipFileEntry } from '../shared/types';

const textEncoder = new TextEncoder();

export type ResolveDocumentAssets = (documentRecords: DocumentRecord[]) => Promise<ImageAsset[]>;
export type ReadAssetData = (asset: ImageAsset) => Promise<Uint8Array<ArrayBuffer>>;

export interface DocumentZipFilesOptions {
  documentRecord: DocumentRecord;
  folderName?: string;
  randomizeImageNames?: boolean;
  readAssetData?: ReadAssetData;
  resolveAssets: ResolveDocumentAssets;
}

export interface DocumentCollectionZipFilesOptions {
  documentRecords: DocumentRecord[];
  randomizeImageNames?: boolean;
  resolveAssets: ResolveDocumentAssets;
}

export interface EditableFolderFilesOptions {
  documentRecord: DocumentRecord;
  readAssetData: ReadAssetData;
  resolveAssets: ResolveDocumentAssets;
}

export interface PortableDocumentFilesOptions {
  documentRecords: DocumentRecord[];
  randomizeImageNames?: boolean;
  readAssetData?: ReadAssetData;
  resolveAssets: ResolveDocumentAssets;
}

export async function createDocumentZipFilesForDocument({
  documentRecord,
  folderName = getDocumentFolderName(documentRecord),
  randomizeImageNames = false,
  readAssetData = readFileAssetData,
  resolveAssets
}: DocumentZipFilesOptions): Promise<ZipFileEntry[]> {
  const assetFiles = await resolveAssets([documentRecord]);
  const assetPathMap = createExportAssetPathMap(assetFiles, {
    randomize: randomizeImageNames
  });
  const files: ZipFileEntry[] = [{
    data: textEncoder.encode(buildDocumentMarkdown({ assetPathMap, documentRecord })),
    path: `${folderName}/index.md`
  }];

  for (const asset of assetFiles) {
    const mappedPath = getMappedAssetPath(asset.path, assetPathMap);
    const assetPath = normalizeDocumentAssetPath(mappedPath);
    files.push({
      data: await readAssetData(asset),
      path: `${folderName}/${assetPath}`
    });
  }

  return files;
}

export async function createDocumentCollectionZipFiles({
  documentRecords,
  randomizeImageNames = false,
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
      randomizeImageNames,
      resolveAssets
    }));
  }

  return files;
}

export async function createPortableDocumentFiles({
  documentRecords,
  randomizeImageNames = false,
  readAssetData = readFileAssetData,
  resolveAssets
}: PortableDocumentFilesOptions): Promise<ZipFileEntry[]> {
  const usedMarkdownPaths = new Set<string>();
  const usedAssetPaths = new Set<string>();
  const assignedAssetPaths = new Map<string, string>();
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

    const assetOutputPathMap = createPortableAssetOutputPathMap(assetFiles, {
      assignedAssetPaths,
      markdownPath,
      randomizeImageNames,
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
        data: await readAssetData(asset),
        path: assetPath
      });
    }
  }

  return dedupeZipEntries(files);
}

export async function createEditableFolderDocumentFiles({
  documentRecord,
  readAssetData,
  resolveAssets
}: EditableFolderFilesOptions): Promise<ZipFileEntry[]> {
  const assetFiles = await resolveAssets([documentRecord]);
  const markdownPath = getDocumentMarkdownPath(documentRecord);
  const assetPathMap = createEditableFolderAssetPathMap(assetFiles, markdownPath);
  const files: ZipFileEntry[] = [{
    data: textEncoder.encode(buildDocumentMarkdown({ assetPathMap, documentRecord })),
    path: markdownPath
  }];

  for (const asset of assetFiles) {
    files.push({
      data: await readAssetData(asset),
      path: normalizeDocumentAssetPath(asset.sourcePath || asset.path)
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

async function readFileAssetData(asset: ImageAsset): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await asset.file.arrayBuffer());
}

function createPortableAssetOutputPathMap(
  assets: ImageAsset[],
  {
    assignedAssetPaths,
    markdownPath,
    randomizeImageNames,
    usedAssetPaths,
    useSourcePaths
  }: {
    assignedAssetPaths: Map<string, string>;
    markdownPath: string;
    randomizeImageNames: boolean;
    usedAssetPaths: Set<string>;
    useSourcePaths: boolean;
  }
): Map<ImageAsset, string> {
  const map = new Map<ImageAsset, string>();
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
    const preferredPath = useSourcePaths && sourcePath
      ? sourcePath
      : normalizeDocumentAssetPath(`${assetDirectory}/${getPortableAssetFileName(asset, randomizeImageNames, usedNames)}`);
    const outputPath = dedupeFilePath(preferredPath || asset.name, usedAssetPaths);
    usedAssetPaths.add(outputPath);
    assignedAssetPaths.set(assetKey, outputPath);
    map.set(asset, outputPath);
  }

  return map;
}

function getAssetOutputKey(asset: ImageAsset): string {
  return normalizeDocumentAssetPath(asset.sourcePath || asset.path || asset.name);
}

function createPortableAssetPathMap(
  assets: ImageAsset[],
  markdownPath: string,
  assetOutputPathMap: Map<ImageAsset, string>
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
  assets: ImageAsset[],
  readAssetData: ReadAssetData
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const asset of assets) {
    addAssetPathAliases(map, asset, `data:${asset.file.type || 'application/octet-stream'};base64,${toBase64(await readAssetData(asset))}`);
  }
  return map;
}

function addAssetPathAliases(map: Map<string, string>, asset: ImageAsset, outputPath: string): void {
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

function getPortableAssetFileName(asset: ImageAsset, randomizeImageNames: boolean, usedNames: Set<string>): string {
  const fileName = randomizeImageNames ? createRandomAssetFileName(asset.name, usedNames) : asset.name;
  const deduped = dedupeFileName(fileName, Array.from(usedNames));
  usedNames.add(deduped);
  return deduped;
}

function createRandomAssetFileName(fileName: string, usedNames: Set<string>): string {
  let name = '';
  do {
    name = `${createShortRandomId()}${getFileExtension(fileName)}`;
  } while (usedNames.has(name));
  return name;
}

function createShortRandomId(): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
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

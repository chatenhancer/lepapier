import { normalizeDocumentAssetPath } from '../documents/document-markdown';
import type {
  AssetMetadata,
  MediaAsset
} from '../shared/types';

export function createAssetId(): string {
  if ('randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `asset-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function serializeAssetMetadata(asset: MediaAsset | null | undefined): AssetMetadata | null {
  if (!asset) return null;
  return {
    id: asset.id,
    name: asset.name,
    path: asset.path,
    sourcePath: asset.sourcePath
  };
}

export function createRestoredMediaAsset(
  metadata: AssetMetadata,
  file: File,
  createObjectUrl: (file: File) => string = URL.createObjectURL
): MediaAsset {
  return {
    file,
    id: String(metadata.id),
    name: metadata.name || file.name,
    path: metadata.path || metadata.name || file.name,
    sourcePath: metadata.sourcePath,
    url: createObjectUrl(file)
  };
}

export function findLiveAsset(
  metadata: AssetMetadata | null | undefined,
  assets: Array<MediaAsset | null | undefined>
): MediaAsset | null {
  if (!metadata?.id && !metadata?.path) return null;

  return assets.find((asset) => {
    if (!asset) return false;
    return asset.id === metadata.id || assetMatchesPath(asset, metadata.path);
  }) || null;
}

export function assetMatchesPath(asset: AssetMetadata | MediaAsset | null | undefined, path: string | undefined): boolean {
  if (!asset || !path) return false;

  const requestedPath = normalizeDocumentAssetPath(path);
  return [asset.path, asset.sourcePath]
    .some((candidate) => normalizeDocumentAssetPath(candidate) === requestedPath);
}

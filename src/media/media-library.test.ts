import { describe, expect, it } from 'vitest';

import type { MediaAsset } from '../shared/types';
import {
  assetMatchesPath,
  createRestoredMediaAsset,
  findLiveAsset,
  serializeAssetMetadata
} from './media-library';

describe('media library helpers', () => {
  it('serializes media assets for draft storage', () => {
    expect(serializeAssetMetadata(createAsset({ id: 'asset-1', path: 'hero.png' }))).toEqual({
      id: 'asset-1',
      name: 'hero.png',
      path: 'hero.png',
      sourcePath: undefined
    });
    expect(serializeAssetMetadata(null)).toBeNull();
  });

  it('matches normalized output and source paths', () => {
    const asset = createAsset({ path: 'hero.png', sourcePath: 'assets/hero.png' });

    expect(assetMatchesPath(asset, './hero.png')).toBe(true);
    expect(assetMatchesPath(asset, '/assets/hero.png')).toBe(true);
    expect(assetMatchesPath(asset, 'missing.png')).toBe(false);
  });

  it('finds live assets by id or normalized path', () => {
    const asset = createAsset({ id: 'asset-1', path: 'hero.png' });

    expect(findLiveAsset({ id: 'asset-1' }, [asset])).toBe(asset);
    expect(findLiveAsset({ path: './hero.png' }, [asset])).toBe(asset);
    expect(findLiveAsset({ path: 'missing.png' }, [asset])).toBeNull();
  });

  it('restores media assets from saved files and metadata', () => {
    const file = new File(['image'], 'original.png', { type: 'image/png' });

    expect(createRestoredMediaAsset({
      id: 'asset-1',
      path: 'hero.png'
    }, file, () => 'blob:hero')).toMatchObject({
      file,
      id: 'asset-1',
      name: 'original.png',
      path: 'hero.png',
      url: 'blob:hero'
    });
  });
});

function createAsset({
  id = 'asset',
  path,
  sourcePath
}: {
  id?: string;
  path: string;
  sourcePath?: string;
}): MediaAsset {
  return {
    file: new File(['image'], path, { type: 'image/png' }),
    id,
    name: path,
    path,
    sourcePath,
    url: `blob:${path}`
  };
}

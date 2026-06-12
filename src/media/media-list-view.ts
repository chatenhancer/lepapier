import type { MediaAsset } from '../shared/types';
import {
  formatMediaMeta,
  isVideoFile
} from './media-assets';

export interface MediaListViewOptions {
  media: MediaAsset[];
  mediaList: HTMLElement;
  mediaTemplate: HTMLTemplateElement;
  onInsertBlock(asset: MediaAsset): void;
  onInsertInline(asset: MediaAsset): void;
}

export function renderMediaList({
  media,
  mediaList,
  mediaTemplate,
  onInsertBlock,
  onInsertInline
}: MediaListViewOptions): void {
  mediaList.replaceChildren();
  for (const asset of media) {
    const row = (mediaTemplate.content.firstElementChild?.cloneNode(true) as HTMLElement | null);
    if (!row) continue;

    const thumbnail = requireChild<HTMLImageElement>(row, 'img');
    const name = requireChild<HTMLElement>(row, '[data-media-name]');
    const meta = requireChild<HTMLElement>(row, '[data-media-meta]');
    const insert = requireChild<HTMLButtonElement>(row, '[data-insert-media]');
    const insertInline = requireChild<HTMLButtonElement>(row, '[data-insert-inline-media]');
    const download = requireChild<HTMLAnchorElement>(row, '[data-download-media]');

    const pathTooltip = `Markdown path: ${asset.path}`;
    name.dataset.tooltip = pathTooltip;
    meta.dataset.tooltip = pathTooltip;
    meta.textContent = formatMediaMeta(asset.file.size);
    if (isVideoFile(asset.file)) {
      const video = row.ownerDocument.createElement('video');
      video.src = asset.url;
      video.muted = true;
      video.preload = 'metadata';
      video.setAttribute('aria-hidden', 'true');
      thumbnail.replaceWith(video);
      insertInline.hidden = true;
    } else {
      thumbnail.addEventListener('load', () => {
        meta.textContent = formatMediaMeta(asset.file.size, thumbnail.naturalWidth, thumbnail.naturalHeight);
      }, { once: true });
      thumbnail.src = asset.url;
      thumbnail.alt = '';
      if (thumbnail.complete && thumbnail.naturalWidth > 0) {
        meta.textContent = formatMediaMeta(asset.file.size, thumbnail.naturalWidth, thumbnail.naturalHeight);
      }
    }
    name.textContent = asset.name;
    insert.addEventListener('click', () => {
      onInsertBlock(asset);
    });
    insertInline.addEventListener('click', () => {
      onInsertInline(asset);
    });
    download.href = asset.url;
    download.download = asset.name;

    mediaList.append(row);
  }
}

function requireChild<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required media row child element: ${selector}`);
  }
  return element;
}

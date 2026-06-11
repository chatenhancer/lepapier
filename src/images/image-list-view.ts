import type { ImageAsset } from '../shared/types';
import { formatImageMeta } from './image-assets';

export interface ImageListViewOptions {
  imageList: HTMLElement;
  imageTemplate: HTMLTemplateElement;
  images: ImageAsset[];
  onInsertBlock(image: ImageAsset): void;
  onInsertInline(image: ImageAsset): void;
}

export function renderImageList({
  imageList,
  imageTemplate,
  images,
  onInsertBlock,
  onInsertInline
}: ImageListViewOptions): void {
  imageList.replaceChildren();
  for (const image of images) {
    const row = (imageTemplate.content.firstElementChild?.cloneNode(true) as HTMLElement | null);
    if (!row) continue;

    const thumbnail = requireChild<HTMLImageElement>(row, 'img');
    const name = requireChild<HTMLElement>(row, '[data-image-name]');
    const meta = requireChild<HTMLElement>(row, '[data-image-meta]');
    const insert = requireChild<HTMLButtonElement>(row, '[data-insert-image]');
    const insertInline = requireChild<HTMLButtonElement>(row, '[data-insert-inline-image]');
    const download = requireChild<HTMLAnchorElement>(row, '[data-download-image]');

    const pathTooltip = `Markdown path: ${image.path}`;
    name.dataset.tooltip = pathTooltip;
    meta.dataset.tooltip = pathTooltip;
    meta.textContent = formatImageMeta(image.file.size);
    thumbnail.addEventListener('load', () => {
      meta.textContent = formatImageMeta(image.file.size, thumbnail.naturalWidth, thumbnail.naturalHeight);
    }, { once: true });
    thumbnail.src = image.url;
    thumbnail.alt = '';
    name.textContent = image.name;
    if (thumbnail.complete && thumbnail.naturalWidth > 0) {
      meta.textContent = formatImageMeta(image.file.size, thumbnail.naturalWidth, thumbnail.naturalHeight);
    }
    insert.addEventListener('click', () => {
      onInsertBlock(image);
    });
    insertInline.addEventListener('click', () => {
      onInsertInline(image);
    });
    download.href = image.url;
    download.download = image.name;

    imageList.append(row);
  }
}

function requireChild<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing required image row child element: ${selector}`);
  }
  return element;
}

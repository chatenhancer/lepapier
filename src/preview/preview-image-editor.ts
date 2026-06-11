import {
  clampImageCropRatio,
  clampImageFocus,
  clampImageRotation,
  clampImageWidth,
  defaultImageCropRatio
} from '../markdown/image-attributes';
import { getMarkdownImageOccurrences } from '../markdown/markdown-editing';
import type { ImageAsset } from '../shared/types';
import {
  setMarkdownImageAlignment,
  setMarkdownImageCrop,
  setMarkdownImageCropFocus,
  setMarkdownImageDisplay,
  setMarkdownImageRotation,
  setMarkdownImageShadow,
  setMarkdownImageWidth,
  wrapMarkdownImageWithSideText
} from './preview-image-transforms';

export interface PreviewImageEditor {
  attach(): void;
  clearSelection(): void;
  getSelectedFrame(): HTMLElement | null;
  replaceImage(frame: HTMLElement, file: File): void;
}

export interface PreviewImageEditorOptions {
  addImageFile(file: File): ImageAsset | null;
  bodyClassTarget?: HTMLElement;
  getMarkdown(): string;
  preview: HTMLElement;
  recordHistory(): void;
  renderImages(): void;
  scheduleAiMetadata(): void;
  setMarkdown(markdown: string): void;
  sync(): void;
}

type ImageAlign = 'center' | 'left' | 'right';
type ImageDisplay = 'block' | 'inline';

export function setupPreviewImageEditor({
  addImageFile,
  bodyClassTarget = document.body,
  getMarkdown,
  preview,
  recordHistory,
  renderImages,
  scheduleAiMetadata,
  setMarkdown,
  sync
}: PreviewImageEditorOptions): PreviewImageEditor {
  const commitMarkdown = (markdown: string) => {
    const currentMarkdown = getMarkdown();
    if (markdown === currentMarkdown) return;

    recordHistory();
    setMarkdown(markdown);
    sync();
  };

  const updateImageWidth = (path: string, width: number) => {
    commitMarkdown(setMarkdownImageWidth(getMarkdown(), path, width));
  };

  const updateImageAlignment = (path: string, align: ImageAlign) => {
    commitMarkdown(setMarkdownImageAlignment(getMarkdown(), path, align));
  };

  const updateImageShadow = (path: string, shadow: boolean) => {
    commitMarkdown(setMarkdownImageShadow(getMarkdown(), path, shadow));
  };

  const updateImageRotation = (path: string, rotation: unknown) => {
    commitMarkdown(setMarkdownImageRotation(getMarkdown(), path, rotation));
  };

  const updateImageCrop = (path: string, cropRatio: unknown) => {
    commitMarkdown(setMarkdownImageCrop(getMarkdown(), path, cropRatio));
  };

  const updateImageCropFocus = (path: string, focusX: unknown, focusY: unknown) => {
    commitMarkdown(setMarkdownImageCropFocus(getMarkdown(), path, focusX, focusY));
  };

  const updateImageDisplay = (path: string, display: ImageDisplay) => {
    commitMarkdown(setMarkdownImageDisplay(getMarkdown(), path, display));
  };

  const wrapImageWithSideText = (path: string, direction: 'left' | 'right') => {
    commitMarkdown(wrapMarkdownImageWithSideText(getMarkdown(), path, direction));
  };

  const selectFrame = (frame: HTMLElement) => {
    for (const selected of preview.querySelectorAll<HTMLElement>('.preview-image-frame.is-selected')) {
      if (selected !== frame) selected.classList.remove('is-selected');
    }
    frame.classList.add('is-selected');
  };

  const selectImageByIndex = (imageIndex: number) => {
    const frame = preview.querySelector<HTMLElement>(`.preview-image-frame[data-image-index="${imageIndex}"]`);
    if (!frame) return;

    selectFrame(frame);
    frame.focus({ preventScroll: true });
  };

  const clearSelection = () => {
    for (const selected of preview.querySelectorAll<HTMLElement>('.preview-image-frame.is-selected')) {
      selected.classList.remove('is-selected');
    }
  };

  const getSelectedFrame = () => preview.querySelector<HTMLElement>('.preview-image-frame.is-selected');

  const replaceImage = (frame: HTMLElement, file: File) => {
    const oldPath = frame.dataset.imagePath;
    const imageIndex = Number(frame.dataset.imageIndex);
    if (!oldPath || !Number.isInteger(imageIndex)) return;

    const body = getMarkdown();
    const occurrence = getMarkdownImageOccurrences(body)
      .find((item) => item.index === imageIndex && item.path === oldPath);
    if (!occurrence) return;

    recordHistory();
    const image = addImageFile(file);
    if (!image) return;

    const replacement = `![${occurrence.alt}](${image.path})${occurrence.rawAttributes ? `{${occurrence.rawAttributes}}` : ''}`;
    setMarkdown(`${body.slice(0, occurrence.start)}${replacement}${body.slice(occurrence.end)}`);
    renderImages();
    sync();
    selectImageByIndex(imageIndex);
    scheduleAiMetadata();
  };

  const attachSelection = () => {
    for (const frame of preview.querySelectorAll<HTMLElement>('.preview-image-frame')) {
      frame.addEventListener('click', () => {
        selectFrame(frame);
      });
      frame.addEventListener('focus', () => {
        selectFrame(frame);
      });
      frame.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.key !== 'Escape') return;
        clearSelection();
        frame.blur();
      });
    }
  };

  const attachResizing = () => {
    for (const frame of preview.querySelectorAll<HTMLElement>('.preview-image-frame')) {
      const handle = frame.querySelector<HTMLElement>('.preview-image-resize');
      const image = frame.querySelector<HTMLImageElement>('img');
      const path = frame.dataset.imagePath;
      if (!handle || !image || !path) continue;

      handle.addEventListener('pointerdown', (event: PointerEvent) => {
        event.preventDefault();
        event.stopPropagation();
        handle.setPointerCapture(event.pointerId);

        const startX = event.clientX;
        const parentWidth = Math.max(1, (frame.parentElement || frame).getBoundingClientRect().width);
        const startWidth = clampImageWidth(Number(frame.dataset.imageWidth || 100));

        const handlePointerMove = (moveEvent: PointerEvent) => {
          const delta = ((moveEvent.clientX - startX) / parentWidth) * 100;
          const width = clampImageWidth(Math.round(startWidth + delta));
          frame.dataset.imageWidth = String(width);
          frame.style.setProperty('--preview-image-width', `${width}%`);
        };

        const handlePointerUp = () => {
          const width = clampImageWidth(Number(frame.dataset.imageWidth || startWidth));
          updateImageWidth(path, width);
          handle.removeEventListener('pointermove', handlePointerMove);
          handle.removeEventListener('pointerup', handlePointerUp);
          handle.removeEventListener('pointercancel', handlePointerUp);
        };

        handle.addEventListener('pointermove', handlePointerMove);
        handle.addEventListener('pointerup', handlePointerUp);
        handle.addEventListener('pointercancel', handlePointerUp);
      });
    }
  };

  const attachCropping = () => {
    for (const frame of preview.querySelectorAll<HTMLElement>('.preview-image-frame')) {
      const cropBox = frame.querySelector<HTMLElement>('.preview-image-crop-box');
      const cropHandle = frame.querySelector<HTMLElement>('.preview-image-crop-resize');
      const path = frame.dataset.imagePath;
      if (!cropBox || !cropHandle || !path) continue;

      cropBox.addEventListener('dblclick', (event: MouseEvent) => {
        if (frame.dataset.imageCrop !== 'true') return;
        event.preventDefault();
        event.stopPropagation();
        updateImageCropFocus(path, 50, 50);
      });

      cropBox.addEventListener('pointerdown', (event: PointerEvent) => {
        if (frame.dataset.imageCrop !== 'true') return;
        event.preventDefault();
        event.stopPropagation();
        cropBox.setPointerCapture(event.pointerId);
        bodyClassTarget.classList.add('is-cropping-image');

        const startX = event.clientX;
        const startY = event.clientY;
        const bounds = cropBox.getBoundingClientRect();
        const startFocusX = clampImageFocus(Number(frame.dataset.imageFocusX || 50));
        const startFocusY = clampImageFocus(Number(frame.dataset.imageFocusY || 50));

        const handlePointerMove = (moveEvent: PointerEvent) => {
          const focusX = clampImageFocus(startFocusX - ((moveEvent.clientX - startX) / Math.max(1, bounds.width)) * 100);
          const focusY = clampImageFocus(startFocusY - ((moveEvent.clientY - startY) / Math.max(1, bounds.height)) * 100);
          setPreviewImageCropFocus(frame, focusX, focusY);
        };

        const handlePointerUp = () => {
          bodyClassTarget.classList.remove('is-cropping-image');
          updateImageCropFocus(path, Number(frame.dataset.imageFocusX || startFocusX), Number(frame.dataset.imageFocusY || startFocusY));
          cropBox.removeEventListener('pointermove', handlePointerMove);
          cropBox.removeEventListener('pointerup', handlePointerUp);
          cropBox.removeEventListener('pointercancel', handlePointerUp);
        };

        cropBox.addEventListener('pointermove', handlePointerMove);
        cropBox.addEventListener('pointerup', handlePointerUp);
        cropBox.addEventListener('pointercancel', handlePointerUp);
      });

      cropHandle.addEventListener('pointerdown', (event: PointerEvent) => {
        if (frame.dataset.imageCrop !== 'true') return;
        event.preventDefault();
        event.stopPropagation();
        cropHandle.setPointerCapture(event.pointerId);
        bodyClassTarget.classList.add('is-cropping-image');

        const startY = event.clientY;
        const startRatio = clampImageCropRatio(Number(frame.dataset.imageCropRatio || defaultImageCropRatio));
        const startHeight = cropBox.getBoundingClientRect().height;

        const handlePointerMove = (moveEvent: PointerEvent) => {
          const nextHeight = Math.max(40, startHeight + moveEvent.clientY - startY);
          const ratio = clampImageCropRatio((startHeight * startRatio) / nextHeight);
          setPreviewImageCropRatio(frame, ratio);
        };

        const handlePointerUp = () => {
          bodyClassTarget.classList.remove('is-cropping-image');
          updateImageCrop(path, Number(frame.dataset.imageCropRatio || startRatio));
          cropHandle.removeEventListener('pointermove', handlePointerMove);
          cropHandle.removeEventListener('pointerup', handlePointerUp);
          cropHandle.removeEventListener('pointercancel', handlePointerUp);
        };

        cropHandle.addEventListener('pointermove', handlePointerMove);
        cropHandle.addEventListener('pointerup', handlePointerUp);
        cropHandle.addEventListener('pointercancel', handlePointerUp);
      });
    }
  };

  const attachRotation = () => {
    for (const frame of preview.querySelectorAll<HTMLElement>('.preview-image-frame')) {
      const handle = frame.querySelector<HTMLElement>('.preview-image-rotate');
      const path = frame.dataset.imagePath;
      if (!handle || !path) continue;

      handle.addEventListener('dblclick', (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        updateImageRotation(path, 0);
      });

      handle.addEventListener('pointerdown', (event: PointerEvent) => {
        event.preventDefault();
        event.stopPropagation();
        handle.setPointerCapture(event.pointerId);
        bodyClassTarget.classList.add('is-tilting-image');

        const startX = event.clientX;
        const startRotation = clampImageRotation(Number(frame.dataset.imageRotation || 0));

        const handlePointerMove = (moveEvent: PointerEvent) => {
          const rotation = clampImageRotation(startRotation + ((moveEvent.clientX - startX) / 12));
          frame.dataset.imageRotation = String(rotation);
          frame.style.setProperty('--preview-image-rotation', `${rotation}deg`);
        };

        const handlePointerUp = () => {
          bodyClassTarget.classList.remove('is-tilting-image');
          const rotation = clampImageRotation(Number(frame.dataset.imageRotation || startRotation));
          updateImageRotation(path, rotation);
          handle.removeEventListener('pointermove', handlePointerMove);
          handle.removeEventListener('pointerup', handlePointerUp);
          handle.removeEventListener('pointercancel', handlePointerUp);
        };

        handle.addEventListener('pointermove', handlePointerMove);
        handle.addEventListener('pointerup', handlePointerUp);
        handle.addEventListener('pointercancel', handlePointerUp);
      });
    }
  };

  const attachActions = () => {
    for (const button of preview.querySelectorAll<HTMLButtonElement>('[data-image-align-center]')) {
      const frame = button.closest<HTMLElement>('.preview-image-frame');
      const path = frame?.dataset.imagePath;
      if (!path || frame.closest('.preview-media-block') || frame.dataset.imageDisplay === 'inline') {
        button.hidden = true;
        continue;
      }

      button.addEventListener('click', () => {
        updateImageAlignment(path, 'center');
      });
    }

    for (const button of preview.querySelectorAll<HTMLButtonElement>('[data-image-side-text]')) {
      const frame = button.closest<HTMLElement>('.preview-image-frame');
      const path = frame?.dataset.imagePath;
      if (!path || frame.closest('.preview-media-block') || frame.dataset.imageDisplay === 'inline') {
        button.hidden = true;
        continue;
      }

      button.addEventListener('click', () => {
        wrapImageWithSideText(path, button.dataset.imageSideText === 'left' ? 'left' : 'right');
      });
    }

    for (const button of preview.querySelectorAll<HTMLButtonElement>('[data-image-shadow-toggle]')) {
      const frame = button.closest<HTMLElement>('.preview-image-frame');
      const path = frame?.dataset.imagePath;
      if (!path) continue;

      button.addEventListener('click', () => {
        updateImageShadow(path, frame.dataset.imageShadow !== 'smooth');
      });
    }

    for (const button of preview.querySelectorAll<HTMLButtonElement>('[data-image-crop-toggle]')) {
      const frame = button.closest<HTMLElement>('.preview-image-frame');
      const path = frame?.dataset.imagePath;
      if (!path || frame.dataset.imageDisplay === 'inline') {
        button.hidden = true;
        continue;
      }

      button.addEventListener('click', () => {
        updateImageCrop(path, frame.dataset.imageCrop === 'true' ? 0 : defaultImageCropRatio);
      });
    }

    for (const button of preview.querySelectorAll<HTMLButtonElement>('[data-image-display-inline]')) {
      const frame = button.closest<HTMLElement>('.preview-image-frame');
      const path = frame?.dataset.imagePath;
      if (!path || frame.closest('.preview-media-block')) {
        button.hidden = true;
        continue;
      }

      button.addEventListener('click', () => {
        updateImageDisplay(path, frame.dataset.imageDisplay === 'inline' ? 'block' : 'inline');
      });
    }
  };

  return {
    attach() {
      attachSelection();
      attachResizing();
      attachCropping();
      attachRotation();
      attachActions();
    },
    clearSelection,
    getSelectedFrame,
    replaceImage
  };
}

function setPreviewImageCropRatio(frame: HTMLElement, ratio: unknown): void {
  const cropRatio = clampImageCropRatio(ratio);
  frame.dataset.imageCropRatio = String(cropRatio);
  frame.style.setProperty('--preview-image-crop-ratio', String(cropRatio));
}

function setPreviewImageCropFocus(frame: HTMLElement, focusX: unknown, focusY: unknown): void {
  const x = clampImageFocus(focusX);
  const y = clampImageFocus(focusY);
  frame.dataset.imageFocusX = String(x);
  frame.dataset.imageFocusY = String(y);
  frame.style.setProperty('--preview-image-focus-x', `${x}%`);
  frame.style.setProperty('--preview-image-focus-y', `${y}%`);
}

import {
  clampImageCropRatio,
  clampImageFocus,
  clampImageRotation,
  clampImageWidth,
  defaultImageCropRatio
} from '../markdown/image-attributes';
import { getMarkdownImageOccurrences } from '../markdown/markdown-editing';
import type { MediaAsset } from '../shared/types';
import {
  removeMarkdownImage,
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
  addMediaFile(file: File): MediaAsset | null;
  bodyClassTarget?: HTMLElement;
  getMarkdown(): string;
  preview: HTMLElement;
  recordHistory(): void;
  renderMedia(): void;
  scheduleAiMetadata(): void;
  setMarkdown(markdown: string): void;
  sync(): void;
}

type ImageAlign = 'center' | 'left' | 'right';
type ImageDisplay = 'block' | 'inline';

interface ImageFrameContext {
  frame: HTMLElement;
  imageIndex: number;
  path: string;
}

interface PointerDragOptions {
  bodyClassName?: string;
  bodyClassTarget?: HTMLElement;
  onEnd(): void;
  onMove(event: PointerEvent): void;
}

export function setupPreviewImageEditor({
  addMediaFile,
  bodyClassTarget = document.body,
  getMarkdown,
  preview,
  recordHistory,
  renderMedia,
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
    const context = getImageFrameContext(frame);
    if (!context) return;

    const body = getMarkdown();
    const occurrence = getMarkdownImageOccurrences(body)
      .find((item) => item.index === context.imageIndex && item.path === context.path);
    if (!occurrence) return;

    recordHistory();
    const image = addMediaFile(file);
    if (!image) return;

    const replacement = `![${occurrence.alt}](${image.path})${occurrence.rawAttributes ? `{${occurrence.rawAttributes}}` : ''}`;
    setMarkdown(`${body.slice(0, occurrence.start)}${replacement}${body.slice(occurrence.end)}`);
    renderMedia();
    sync();
    selectImageByIndex(context.imageIndex);
    scheduleAiMetadata();
  };

  const removeImage = (frame: HTMLElement) => {
    const context = getImageFrameContext(frame);
    if (!context) return;

    const body = getMarkdown();
    const markdown = removeMarkdownImage(body, context.path, context.imageIndex);
    if (markdown === body) return;

    commitMarkdown(markdown);
    scheduleAiMetadata();
  };

  const attachSelection = () => {
    for (const frame of preview.querySelectorAll<HTMLElement>('.preview-image-frame')) {
      frame.addEventListener('click', (event: MouseEvent) => {
        selectFrame(frame);
        if (!isImageControlTarget(event.target)) {
          frame.focus({ preventScroll: true });
        }
      });
      frame.addEventListener('focus', () => {
        selectFrame(frame);
      });
      frame.addEventListener('keydown', (event: KeyboardEvent) => {
        if (event.target !== frame) return;
        if (event.key === 'Escape') {
          clearSelection();
          frame.blur();
          return;
        }
        if (event.key !== 'Delete' && event.key !== 'Backspace') return;

        event.preventDefault();
        event.stopPropagation();
        removeImage(frame);
      });
    }
  };

  const attachResizing = () => {
    for (const frame of preview.querySelectorAll<HTMLElement>('.preview-image-frame')) {
      const handle = frame.querySelector<HTMLElement>('.preview-image-resize');
      const context = getImageFrameContext(frame);
      if (!handle || !frame.querySelector('img') || !context) continue;

      handle.addEventListener('pointerdown', (event: PointerEvent) => {
        const startX = event.clientX;
        const parentWidth = Math.max(1, (frame.parentElement || frame).getBoundingClientRect().width);
        const startWidth = clampImageWidth(Number(frame.dataset.imageWidth || 100));

        startPointerDrag(handle, event, {
          onMove(moveEvent) {
            const delta = ((moveEvent.clientX - startX) / parentWidth) * 100;
            const width = clampImageWidth(Math.round(startWidth + delta));
            frame.dataset.imageWidth = String(width);
            frame.style.setProperty('--preview-image-width', `${width}%`);
          },
          onEnd() {
            const width = clampImageWidth(Number(frame.dataset.imageWidth || startWidth));
            updateImageWidth(context.path, width);
          }
        });
      });
    }
  };

  const attachCropping = () => {
    for (const frame of preview.querySelectorAll<HTMLElement>('.preview-image-frame')) {
      const cropBox = frame.querySelector<HTMLElement>('.preview-image-crop-box');
      const cropHandle = frame.querySelector<HTMLElement>('.preview-image-crop-resize');
      const context = getImageFrameContext(frame);
      if (!cropBox || !cropHandle || !context) continue;

      cropBox.addEventListener('dblclick', (event: MouseEvent) => {
        if (frame.dataset.imageCrop !== 'true') return;
        event.preventDefault();
        event.stopPropagation();
        updateImageCropFocus(context.path, 50, 50);
      });

      cropBox.addEventListener('pointerdown', (event: PointerEvent) => {
        if (frame.dataset.imageCrop !== 'true') return;

        const startX = event.clientX;
        const startY = event.clientY;
        const bounds = cropBox.getBoundingClientRect();
        const startFocusX = clampImageFocus(Number(frame.dataset.imageFocusX || 50));
        const startFocusY = clampImageFocus(Number(frame.dataset.imageFocusY || 50));

        startPointerDrag(cropBox, event, {
          bodyClassName: 'is-cropping-image',
          bodyClassTarget,
          onMove(moveEvent) {
            const focusX = clampImageFocus(startFocusX - ((moveEvent.clientX - startX) / Math.max(1, bounds.width)) * 100);
            const focusY = clampImageFocus(startFocusY - ((moveEvent.clientY - startY) / Math.max(1, bounds.height)) * 100);
            setPreviewImageCropFocus(frame, focusX, focusY);
          },
          onEnd() {
            updateImageCropFocus(context.path, Number(frame.dataset.imageFocusX || startFocusX), Number(frame.dataset.imageFocusY || startFocusY));
          }
        });
      });

      cropHandle.addEventListener('pointerdown', (event: PointerEvent) => {
        if (frame.dataset.imageCrop !== 'true') return;

        const startY = event.clientY;
        const startRatio = clampImageCropRatio(Number(frame.dataset.imageCropRatio || defaultImageCropRatio));
        const startHeight = cropBox.getBoundingClientRect().height;

        startPointerDrag(cropHandle, event, {
          bodyClassName: 'is-cropping-image',
          bodyClassTarget,
          onMove(moveEvent) {
            const nextHeight = Math.max(40, startHeight + moveEvent.clientY - startY);
            const ratio = clampImageCropRatio((startHeight * startRatio) / nextHeight);
            setPreviewImageCropRatio(frame, ratio);
          },
          onEnd() {
            updateImageCrop(context.path, Number(frame.dataset.imageCropRatio || startRatio));
          }
        });
      });
    }
  };

  const attachRotation = () => {
    for (const frame of preview.querySelectorAll<HTMLElement>('.preview-image-frame')) {
      const handle = frame.querySelector<HTMLElement>('.preview-image-rotate');
      const context = getImageFrameContext(frame);
      if (!handle || !context) continue;

      handle.addEventListener('dblclick', (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        updateImageRotation(context.path, 0);
      });

      handle.addEventListener('pointerdown', (event: PointerEvent) => {
        const startX = event.clientX;
        const startRotation = clampImageRotation(Number(frame.dataset.imageRotation || 0));

        startPointerDrag(handle, event, {
          bodyClassName: 'is-tilting-image',
          bodyClassTarget,
          onMove(moveEvent) {
            const rotation = clampImageRotation(startRotation + ((moveEvent.clientX - startX) / 12));
            frame.dataset.imageRotation = String(rotation);
            frame.style.setProperty('--preview-image-rotation', `${rotation}deg`);
          },
          onEnd() {
            const rotation = clampImageRotation(Number(frame.dataset.imageRotation || startRotation));
            updateImageRotation(context.path, rotation);
          }
        });
      });
    }
  };

  const attachImageAction = (
    selector: string,
    {
      hiddenWhen = () => false,
      onClick
    }: {
      hiddenWhen?: (frame: HTMLElement) => boolean;
      onClick(context: ImageFrameContext & { button: HTMLButtonElement }): void;
    }
  ) => {
    for (const button of preview.querySelectorAll<HTMLButtonElement>(selector)) {
      const context = getImageButtonContext(button);
      if (!context || hiddenWhen(context.frame)) {
        button.hidden = true;
        continue;
      }

      button.addEventListener('click', () => onClick(context));
    }
  };

  const attachActions = () => {
    attachImageAction('[data-image-align-center]', {
      hiddenWhen: (frame) => isMediaBlockFrame(frame) || isInlineImageFrame(frame),
      onClick: ({ frame, path }) => updateImageAlignment(path, frame.dataset.imageAlign === 'center' ? 'left' : 'center')
    });

    attachImageAction('[data-image-side-text]', {
      hiddenWhen: (frame) => isMediaBlockFrame(frame) || isInlineImageFrame(frame),
      onClick: ({ button, path }) => wrapImageWithSideText(path, button.dataset.imageSideText === 'left' ? 'left' : 'right')
    });

    attachImageAction('[data-image-shadow-toggle]', {
      onClick: ({ frame, path }) => updateImageShadow(path, frame.dataset.imageShadow !== 'smooth')
    });

    attachImageAction('[data-image-crop-toggle]', {
      hiddenWhen: isInlineImageFrame,
      onClick: ({ frame, path }) => updateImageCrop(path, frame.dataset.imageCrop === 'true' ? 0 : defaultImageCropRatio)
    });

    attachImageAction('[data-image-display-inline]', {
      hiddenWhen: isMediaBlockFrame,
      onClick: ({ frame, path }) => updateImageDisplay(path, frame.dataset.imageDisplay === 'inline' ? 'block' : 'inline')
    });
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

function getImageFrameContext(frame: HTMLElement | null): ImageFrameContext | null {
  if (!frame) return null;

  const path = frame.dataset.imagePath;
  const imageIndex = Number(frame.dataset.imageIndex);
  if (!path || !Number.isInteger(imageIndex)) return null;

  return {
    frame,
    imageIndex,
    path
  };
}

function getImageButtonContext(button: HTMLButtonElement): ImageFrameContext & { button: HTMLButtonElement } | null {
  const frameContext = getImageFrameContext(button.closest<HTMLElement>('.preview-image-frame'));
  return frameContext ? { ...frameContext, button } : null;
}

function isMediaBlockFrame(frame: HTMLElement): boolean {
  return Boolean(frame.closest('.preview-media-block'));
}

function isInlineImageFrame(frame: HTMLElement): boolean {
  return frame.dataset.imageDisplay === 'inline';
}

function startPointerDrag(
  target: HTMLElement,
  event: PointerEvent,
  {
    bodyClassName,
    bodyClassTarget,
    onEnd,
    onMove
  }: PointerDragOptions
): void {
  event.preventDefault();
  event.stopPropagation();
  target.setPointerCapture(event.pointerId);
  if (bodyClassName) {
    bodyClassTarget?.classList.add(bodyClassName);
  }

  const handlePointerMove = (moveEvent: PointerEvent) => {
    onMove(moveEvent);
  };

  const handlePointerUp = () => {
    if (bodyClassName) {
      bodyClassTarget?.classList.remove(bodyClassName);
    }
    onEnd();
    target.removeEventListener('pointermove', handlePointerMove);
    target.removeEventListener('pointerup', handlePointerUp);
    target.removeEventListener('pointercancel', handlePointerUp);
  };

  target.addEventListener('pointermove', handlePointerMove);
  target.addEventListener('pointerup', handlePointerUp);
  target.addEventListener('pointercancel', handlePointerUp);
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

function isImageControlTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest([
    '.preview-image-tools',
    '.preview-image-resize',
    '.preview-image-crop-resize',
    '.preview-image-rotate'
  ].join(',')));
}

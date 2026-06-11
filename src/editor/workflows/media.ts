import {
  getImageAltText
} from '../../images/image-assets';
import {
  assetMatchesPath
} from '../../images/image-library';
import { renderImageList } from '../../images/image-list-view';
import { replaceSelection } from '../../markdown/selection';
import {
  dedupeFileName,
  sanitizeFileName
} from '../../shared/text';
import type { ImageAsset } from '../../shared/types';

export interface EditorMediaWorkflow {
  addImageFile(file: File): ImageAsset | null;
  getCurrentAssetNames(): string[];
  getPreviewAssetUrl(path: string): string;
  insertDroppedImages(files: File[]): void;
  renderCover(): void;
  renderImages(): void;
  setCoverFile(file: File): void;
}

export interface EditorMediaWorkflowOptions {
  bodyInput: HTMLTextAreaElement;
  coverPath: HTMLElement;
  coverPreview: HTMLElement;
  coverStatus: HTMLElement;
  createAssetId(): string;
  getCoverImage(): ImageAsset | null;
  getFieldValue(name: 'image'): string;
  imageList: HTMLElement;
  imageTemplate: HTMLTemplateElement;
  isPreviewActive(): boolean;
  exitPreviewMode(): void;
  recordHistory(): void;
  saveAsset(asset: ImageAsset): Promise<void>;
  scheduleMetadata(): void;
  selectedImages: ImageAsset[];
  setCoverImage(asset: ImageAsset | null): void;
  setFieldValue(name: 'image', value: string): void;
  showSaveState(text: string): void;
  sync(): void;
}

export function createEditorMediaWorkflow({
  bodyInput,
  coverPath,
  coverPreview,
  coverStatus,
  createAssetId,
  getCoverImage,
  getFieldValue,
  imageList,
  imageTemplate,
  isPreviewActive,
  exitPreviewMode,
  recordHistory,
  saveAsset,
  scheduleMetadata,
  selectedImages,
  setCoverImage,
  setFieldValue,
  showSaveState,
  sync
}: EditorMediaWorkflowOptions): EditorMediaWorkflow {
  const getCurrentAssetNames = () => [
    getCoverImage()?.name,
    ...selectedImages.map((image) => image.name)
  ].filter((name): name is string => Boolean(name));

  const renderCover = () => {
    const coverImage = getCoverImage();
    const imageFieldValue = getFieldValue('image');
    coverStatus.textContent = coverImage ? 'Ready' : imageFieldValue ? 'Path only' : 'No cover';
    coverPreview.hidden = !coverImage;

    if (!coverImage) return;

    coverPreview.querySelector<HTMLImageElement>('img')?.setAttribute('src', coverImage.url);
    coverPath.textContent = coverImage.path;
  };

  const renderImages = () => {
    renderImageList({
      imageList,
      imageTemplate,
      images: selectedImages,
      onInsertBlock(image) {
        insertImageMarkdown(image, false);
      },
      onInsertInline(image) {
        insertImageMarkdown(image, true);
      }
    });
  };

  const setCoverFile = (file: File) => {
    const currentCover = getCoverImage();
    if (currentCover?.url) URL.revokeObjectURL(currentCover.url);

    const name = dedupeFileName(sanitizeFileName(file.name), selectedImages.map((image) => image.name));
    const coverImage = {
      file,
      id: createAssetId(),
      name,
      path: name,
      url: URL.createObjectURL(file)
    };
    setCoverImage(coverImage);
    void saveAsset(coverImage).catch(() => {
      showSaveState('Cover image could not be saved for refresh');
    });
    setFieldValue('image', coverImage.path);
    renderCover();
  };

  const addImageFile = (file: File): ImageAsset | null => {
    if (!file.type.startsWith('image/')) return null;

    const name = dedupeFileName(sanitizeFileName(file.name), getCurrentAssetNames());
    const image = {
      file,
      id: createAssetId(),
      name,
      path: name,
      url: URL.createObjectURL(file)
    };
    selectedImages.push(image);
    void saveAsset(image).catch(() => {
      showSaveState('Image could not be saved for refresh');
    });
    return image;
  };

  const insertDroppedImages = (files: File[]) => {
    if (isPreviewActive()) {
      exitPreviewMode();
    }

    const snippets: string[] = [];
    for (const file of files) {
      const image = addImageFile(file);
      if (image) {
        snippets.push(`![${getImageAltText(image.name)}](${image.path})`);
      }
    }

    if (!snippets.length) return;

    recordHistory();
    replaceSelection(bodyInput, snippets.join('\n\n'));
    renderImages();
    sync();
    scheduleMetadata();
  };

  const insertImageMarkdown = (image: ImageAsset, inline: boolean) => {
    if (isPreviewActive()) {
      exitPreviewMode();
    }
    recordHistory();
    replaceSelection(bodyInput, inline ? `![Alt text](${image.path}){display=inline}` : `![Alt text](${image.path})`);
    sync();
  };

  const getPreviewAssetUrl = (path: string) => {
    const asset = [getCoverImage(), ...selectedImages].find((image) => assetMatchesPath(image, path));
    return asset?.url || path;
  };

  return {
    addImageFile,
    getCurrentAssetNames,
    getPreviewAssetUrl,
    insertDroppedImages,
    renderCover,
    renderImages,
    setCoverFile
  };
}

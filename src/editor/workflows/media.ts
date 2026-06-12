import {
  getMediaAltText,
  isSupportedMediaFile,
  isVideoFile,
  sanitizeMediaFileName
} from '../../media/media-assets';
import {
  assetMatchesPath
} from '../../media/media-library';
import { renderMediaList } from '../../media/media-list-view';
import { replaceSelection } from '../../markdown/selection';
import {
  dedupeFileName,
  sanitizeFileName
} from '../../shared/text';
import type { MediaAsset } from '../../shared/types';

export interface EditorMediaWorkflow {
  addMediaFile(file: File): MediaAsset | null;
  getCurrentAssetNames(): string[];
  getPreviewAssetUrl(path: string): string;
  insertDroppedMedia(files: File[]): void;
  renderCover(): void;
  renderMedia(): void;
  setCoverFile(file: File): void;
}

export interface EditorMediaWorkflowOptions {
  bodyInput: HTMLTextAreaElement;
  coverPath: HTMLElement;
  coverPreview: HTMLElement;
  coverStatus: HTMLElement;
  createAssetId(): string;
  getCoverImage(): MediaAsset | null;
  getFieldValue(name: 'image'): string;
  mediaList: HTMLElement;
  mediaTemplate: HTMLTemplateElement;
  isPreviewActive(): boolean;
  exitPreviewMode(): void;
  recordHistory(): void;
  saveAsset(asset: MediaAsset): Promise<void>;
  scheduleMetadata(): void;
  selectedMedia: MediaAsset[];
  setCoverImage(asset: MediaAsset | null): void;
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
  mediaList,
  mediaTemplate,
  isPreviewActive,
  exitPreviewMode,
  recordHistory,
  saveAsset,
  scheduleMetadata,
  selectedMedia,
  setCoverImage,
  setFieldValue,
  showSaveState,
  sync
}: EditorMediaWorkflowOptions): EditorMediaWorkflow {
  const getCurrentAssetNames = () => [
    getCoverImage()?.name,
    ...selectedMedia.map((asset) => asset.name)
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

  const renderMedia = () => {
    renderMediaList({
      media: selectedMedia,
      mediaList,
      mediaTemplate,
      onInsertBlock(asset) {
        insertMediaMarkdown(asset, false);
      },
      onInsertInline(asset) {
        insertMediaMarkdown(asset, true);
      }
    });
  };

  const setCoverFile = (file: File) => {
    const currentCover = getCoverImage();
    if (currentCover?.url) URL.revokeObjectURL(currentCover.url);

    const name = dedupeFileName(sanitizeFileName(file.name), selectedMedia.map((asset) => asset.name));
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

  const addMediaFile = (file: File): MediaAsset | null => {
    if (!isSupportedMediaFile(file)) return null;

    const name = dedupeFileName(sanitizeMediaFileName(file), getCurrentAssetNames());
    const asset = {
      file,
      id: createAssetId(),
      name,
      path: name,
      url: URL.createObjectURL(file)
    };
    selectedMedia.push(asset);
    void saveAsset(asset).catch(() => {
      showSaveState('Media could not be saved for refresh');
    });
    return asset;
  };

  const insertDroppedMedia = (files: File[]) => {
    if (isPreviewActive()) {
      exitPreviewMode();
    }

    const snippets: string[] = [];
    for (const file of files) {
      const asset = addMediaFile(file);
      if (asset) {
        snippets.push(`![${getMediaAltText(asset.name, asset.file.type)}](${asset.path})`);
      }
    }

    if (!snippets.length) return;

    recordHistory();
    replaceSelection(bodyInput, snippets.join('\n\n'));
    renderMedia();
    sync();
    scheduleMetadata();
  };

  const insertMediaMarkdown = (asset: MediaAsset, inline: boolean) => {
    if (isPreviewActive()) {
      exitPreviewMode();
    }
    recordHistory();
    const altText = getMediaAltText(asset.name, asset.file.type);
    replaceSelection(bodyInput, inline && !isVideoFile(asset.file) ? `![${altText}](${asset.path}){display=inline}` : `![${altText}](${asset.path})`);
    sync();
  };

  const getPreviewAssetUrl = (path: string) => {
    const asset = [getCoverImage(), ...selectedMedia].find((candidate) => assetMatchesPath(candidate, path));
    return asset?.url || path;
  };

  return {
    addMediaFile,
    getCurrentAssetNames,
    getPreviewAssetUrl,
    insertDroppedMedia,
    renderCover,
    renderMedia,
    setCoverFile
  };
}

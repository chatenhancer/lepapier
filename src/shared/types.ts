export interface AssetMetadata {
  id?: string;
  name?: string;
  path?: string;
  sourcePath?: string;
}

export interface MediaAsset {
  file: File;
  id: string;
  name: string;
  path: string;
  sourcePath?: string;
  url: string;
}

export interface EditableFolderState {
  connected: boolean;
  directoryHandle: FileSystemDirectoryHandle;
}

export interface EditableFileState {
  connected: boolean;
  fileHandle: FileSystemFileHandle;
}

export type DocumentSourceMode = 'browser' | 'file' | 'folder' | 'editable-file' | 'editable-folder';

export interface DocumentSource {
  markdownPath?: string;
  mode: DocumentSourceMode;
}

export interface DocumentFields {
  body: string;
  date: string;
  description: string;
  image: string;
  slug: string;
  tags: string;
  title: string;
}

export interface DocumentEditState {
  description: boolean;
  slug: boolean;
  tags: boolean;
  title: boolean;
}

export interface DocumentRecord {
  coverImage: AssetMetadata | null;
  editState: DocumentEditState;
  fields: DocumentFields;
  frontmatterExtras: string[];
  id: string;
  paperWidth: number;
  source?: DocumentSource | null;
  updatedAt: number;
  viewMode: 'preview' | 'write';
}

export interface WorkspaceDraft {
  activeDocumentId: string;
  documents: DocumentRecord[];
  media?: AssetMetadata[];
  randomizeMediaNames?: boolean;
  smartPunctuation?: boolean;
  version?: number;
}

export interface ZipFileEntry {
  data: Uint8Array<ArrayBuffer>;
  path: string;
}

interface DirectoryPickerWindow extends Window {
  showDirectoryPicker?: (options?: { mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
}

interface FilePickerWindow extends Window {
  showOpenFilePicker?: (options?: {
    excludeAcceptAllOption?: boolean;
    multiple?: boolean;
    types?: Array<{
      accept: Record<string, string[]>;
      description: string;
    }>;
  }) => Promise<FileSystemFileHandle[]>;
}

export function canPickDirectory(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export function canPickWritableDirectory(): boolean {
  return canPickDirectory();
}

export function canPickWritableFile(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

export async function pickReadableDirectory(): Promise<FileSystemDirectoryHandle> {
  const pickerWindow = window as DirectoryPickerWindow;
  if (!pickerWindow.showDirectoryPicker) {
    throw new Error('File System Access directory picker is not available.');
  }

  return await pickerWindow.showDirectoryPicker({ mode: 'read' });
}

export async function pickWritableDirectory(): Promise<FileSystemDirectoryHandle> {
  const pickerWindow = window as DirectoryPickerWindow;
  if (!pickerWindow.showDirectoryPicker) {
    throw new Error('File System Access directory picker is not available.');
  }

  return await pickerWindow.showDirectoryPicker({ mode: 'readwrite' });
}

export async function pickWritableMarkdownFile(): Promise<FileSystemFileHandle> {
  const pickerWindow = window as FilePickerWindow;
  if (!pickerWindow.showOpenFilePicker) {
    throw new Error('File System Access file picker is not available.');
  }

  const [fileHandle] = await pickerWindow.showOpenFilePicker({
    excludeAcceptAllOption: false,
    multiple: false,
    types: [{
      accept: {
        'text/markdown': ['.md'],
        'text/plain': ['.md']
      },
      description: 'Markdown files'
    }]
  });
  if (!fileHandle) throw new Error('No Markdown file selected.');
  return fileHandle;
}

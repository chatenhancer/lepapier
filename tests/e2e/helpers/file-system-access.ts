import type { Page } from '@playwright/test';

export interface FileWrite {
  name: string;
  text: string;
}

export interface FolderWrite {
  path: string;
  text: string;
}

export interface FakeFolderFile {
  bytes?: number[];
  path: string;
  text?: string;
  type?: string;
}

interface TestFileSystemState {
  fileWrites: FileWrite[];
  folderWrites: FolderWrite[];
}

export async function installDraftWriteFailure(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function setItem(key: string, value: string) {
      if (key === 'lepapier-draft-v1') {
        throw new Error('Test draft write failure');
      }
      return originalSetItem.call(this, key, value);
    };
  });
}

export async function installWritableFileMock(page: Page, { name, text }: { name: string; text: string }): Promise<void> {
  await page.addInitScript(({ fileName, fileText }) => {
    installTestFileSystemState();

    class FakeFileHandle {
      kind = 'file' as const;
      name: string;
      path: string;
      text: string;
      type = 'text/markdown';

      constructor(name: string, text: string, path = name) {
        this.name = name;
        this.path = path;
        this.text = text;
      }

      async queryPermission(): Promise<PermissionState> {
        return 'granted';
      }

      async requestPermission(): Promise<PermissionState> {
        return 'granted';
      }

      async getFile(): Promise<File> {
        return new File([this.text], this.name, { type: this.type });
      }

      async createWritable() {
        const handle = this;
        const chunks: string[] = [];
        return {
          async write(chunk: unknown) {
            chunks.push(await chunkToText(chunk));
          },
          async close() {
            handle.text = chunks.join('');
            getTestFileSystemState().fileWrites.push({
              name: handle.name,
              text: handle.text
            });
          },
          async abort() {
            chunks.length = 0;
          }
        };
      }
    }

    const testWindow = window as typeof window & {
      showOpenFilePicker?: () => Promise<FakeFileHandle[]>;
    };
    testWindow.showOpenFilePicker = async () => [new FakeFileHandle(fileName, fileText)];

    function installTestFileSystemState(): void {
      const stateWindow = window as typeof window & { __lepapierTestFileSystem?: TestFileSystemState };
      stateWindow.__lepapierTestFileSystem = {
        fileWrites: [],
        folderWrites: []
      };
    }

    function getTestFileSystemState(): TestFileSystemState {
      return (window as typeof window & { __lepapierTestFileSystem: TestFileSystemState }).__lepapierTestFileSystem;
    }

    async function chunkToText(chunk: unknown): Promise<string> {
      if (typeof chunk === 'string') return chunk;
      if (chunk instanceof Blob) return await chunk.text();
      if (chunk instanceof ArrayBuffer) return new TextDecoder().decode(chunk);
      if (ArrayBuffer.isView(chunk)) {
        return new TextDecoder().decode(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
      }
      return String(chunk || '');
    }
  }, { fileName: name, fileText: text });
}

export async function installWritableFolderMock(
  page: Page,
  { files = [], path, text }: { files?: FakeFolderFile[]; path: string; text: string }
): Promise<void> {
  await page.addInitScript(({ folderFiles, markdownPath, markdownText }) => {
    installTestFileSystemState();

    class FakeFileHandle {
      kind = 'file' as const;
      bytes: Uint8Array;
      name: string;
      path: string;
      type: string;

      constructor(name: string, bytes: Uint8Array, path: string, type = inferFileType(name)) {
        this.bytes = bytes;
        this.name = name;
        this.path = path;
        this.type = type;
      }

      async queryPermission(): Promise<PermissionState> {
        return 'granted';
      }

      async requestPermission(): Promise<PermissionState> {
        return 'granted';
      }

      async getFile(): Promise<File> {
        return new File([toArrayBuffer(this.bytes)], this.name, { type: this.type });
      }

      async createWritable() {
        const handle = this;
        const chunks: Uint8Array[] = [];
        return {
          async write(chunk: unknown) {
            chunks.push(await chunkToBytes(chunk));
          },
          async close() {
            handle.bytes = concatBytes(chunks);
            getTestFileSystemState().folderWrites.push({
              path: handle.path,
              text: new TextDecoder().decode(handle.bytes)
            });
          },
          async abort() {
            chunks.length = 0;
          }
        };
      }
    }

    class FakeDirectoryHandle {
      kind = 'directory' as const;
      children = new Map<string, FakeDirectoryHandle | FakeFileHandle>();
      name: string;
      path: string;

      constructor(name: string, path = name) {
        this.name = name;
        this.path = path;
      }

      async queryPermission(): Promise<PermissionState> {
        return 'granted';
      }

      async requestPermission(): Promise<PermissionState> {
        return 'granted';
      }

      async *entries(): AsyncIterableIterator<[string, FakeDirectoryHandle | FakeFileHandle]> {
        for (const entry of this.children) {
          yield entry;
        }
      }

      async getDirectoryHandle(name: string, options: { create?: boolean } = {}): Promise<FakeDirectoryHandle> {
        const existing = this.children.get(name);
        if (existing instanceof FakeDirectoryHandle) return existing;
        if (!options.create) throw new Error(`Missing directory ${name}`);

        const directory = new FakeDirectoryHandle(name, joinPath(this.path, name));
        this.children.set(name, directory);
        return directory;
      }

      async getFileHandle(name: string, options: { create?: boolean } = {}): Promise<FakeFileHandle> {
        const existing = this.children.get(name);
        if (existing instanceof FakeFileHandle) return existing;
        if (!options.create) throw new Error(`Missing file ${name}`);

        const file = new FakeFileHandle(name, new Uint8Array(), joinPath(this.path, name));
        this.children.set(name, file);
        return file;
      }
    }

    const root = new FakeDirectoryHandle('', '');
    addFile(root, {
      path: markdownPath,
      text: markdownText,
      type: 'text/markdown'
    });
    for (const file of folderFiles) {
      addFile(root, file);
    }

    const testWindow = window as typeof window & {
      showDirectoryPicker?: () => Promise<FakeDirectoryHandle>;
    };
    testWindow.showDirectoryPicker = async () => root;

    function addFile(rootDirectory: FakeDirectoryHandle, file: FakeFolderFile): void {
      const parts = file.path.split('/').filter(Boolean);
      const fileName = parts.pop();
      if (!fileName) throw new Error('Missing fake markdown file name.');

      let directory = rootDirectory;
      for (const part of parts) {
        let next = directory.children.get(part);
        if (!(next instanceof FakeDirectoryHandle)) {
          next = new FakeDirectoryHandle(part, joinPath(directory.path, part));
          directory.children.set(part, next);
        }
        directory = next;
      }

      directory.children.set(fileName, new FakeFileHandle(
        fileName,
        file.bytes ? new Uint8Array(file.bytes) : new TextEncoder().encode(file.text || ''),
        joinPath(directory.path, fileName),
        file.type || inferFileType(fileName)
      ));
    }

    function joinPath(parent: string, child: string): string {
      return [parent, child].filter(Boolean).join('/');
    }

    function installTestFileSystemState(): void {
      const stateWindow = window as typeof window & { __lepapierTestFileSystem?: TestFileSystemState };
      stateWindow.__lepapierTestFileSystem = {
        fileWrites: [],
        folderWrites: []
      };
    }

    function getTestFileSystemState(): TestFileSystemState {
      return (window as typeof window & { __lepapierTestFileSystem: TestFileSystemState }).__lepapierTestFileSystem;
    }

    async function chunkToBytes(chunk: unknown): Promise<Uint8Array> {
      if (typeof chunk === 'string') return new TextEncoder().encode(chunk);
      if (chunk instanceof Blob) return new Uint8Array(await chunk.arrayBuffer());
      if (chunk instanceof ArrayBuffer) return new Uint8Array(chunk);
      if (ArrayBuffer.isView(chunk)) {
        return new Uint8Array(chunk.buffer.slice(chunk.byteOffset, chunk.byteOffset + chunk.byteLength));
      }
      return new TextEncoder().encode(String(chunk || ''));
    }

    function concatBytes(chunks: Uint8Array[]): Uint8Array {
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const bytes = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      return bytes;
    }

    function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
      const copy = new Uint8Array(bytes.length);
      copy.set(bytes);
      return copy.buffer as ArrayBuffer;
    }

    function inferFileType(name: string): string {
      if (/\.md$/i.test(name)) return 'text/markdown';
      if (/\.png$/i.test(name)) return 'image/png';
      if (/\.jpe?g$/i.test(name)) return 'image/jpeg';
      if (/\.webp$/i.test(name)) return 'image/webp';
      if (/\.mp4$/i.test(name)) return 'video/mp4';
      return 'application/octet-stream';
    }
  }, { folderFiles: files, markdownPath: path, markdownText: text });
}

export async function getWritableFileWrites(page: Page): Promise<FileWrite[]> {
  return page.evaluate(() => {
    return (window as typeof window & { __lepapierTestFileSystem?: TestFileSystemState })
      .__lepapierTestFileSystem?.fileWrites || [];
  });
}

export async function getWritableFolderWrites(page: Page): Promise<FolderWrite[]> {
  return page.evaluate(() => {
    return (window as typeof window & { __lepapierTestFileSystem?: TestFileSystemState })
      .__lepapierTestFileSystem?.folderWrites || [];
  });
}

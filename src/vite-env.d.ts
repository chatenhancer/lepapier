/// <reference types="vite/client" />

declare const __LEPAPIER_BUILD_TIMESTAMP__: string;

interface FileSystemHandle {
  queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
}

interface FileSystemDirectoryHandle {
  entries(): AsyncIterableIterator<[string, FileSystemDirectoryHandle | FileSystemFileHandle]>;
}

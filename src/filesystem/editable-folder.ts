export async function ensureEditableFolderPermission(directoryHandle: FileSystemDirectoryHandle): Promise<boolean> {
  const permission = { mode: 'readwrite' as const };
  if (await directoryHandle.queryPermission(permission) === 'granted') return true;
  return await directoryHandle.requestPermission(permission) === 'granted';
}

export async function getEditableFolderPermissionState(directoryHandle: FileSystemDirectoryHandle): Promise<PermissionState> {
  try {
    return await directoryHandle.queryPermission({ mode: 'readwrite' });
  } catch {
    return 'prompt';
  }
}

export async function ensureEditableFilePermission(fileHandle: FileSystemFileHandle): Promise<boolean> {
  const permission = { mode: 'readwrite' as const };
  if (await fileHandle.queryPermission(permission) === 'granted') return true;
  return await fileHandle.requestPermission(permission) === 'granted';
}

export async function getEditableFilePermissionState(fileHandle: FileSystemFileHandle): Promise<PermissionState> {
  try {
    return await fileHandle.queryPermission({ mode: 'readwrite' });
  } catch {
    return 'prompt';
  }
}

export async function readEditableFile(fileHandle: FileSystemFileHandle): Promise<File> {
  return await fileHandle.getFile();
}

export async function writeDataToEditableFile(fileHandle: FileSystemFileHandle, data: Uint8Array<ArrayBuffer>): Promise<void> {
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(data);
    await writable.close();
  } catch (error) {
    await writable.abort();
    throw error;
  }
}

export async function readEditableFolderFiles(
  directoryHandle: FileSystemDirectoryHandle,
  trackFilePath: (file: File, relativePath: string) => void
): Promise<File[]> {
  const files: File[] = [];
  await collectEditableFolderFiles(directoryHandle, '', files, trackFilePath);
  return files;
}

export async function readEditableFolderFile(
  directoryHandle: FileSystemDirectoryHandle,
  path: string,
  normalizePath: (path: string) => string,
  trackFilePath: (file: File, relativePath: string) => void
): Promise<File> {
  const normalizedPath = normalizePath(path);
  const parts = normalizedPath.split('/').filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) throw new Error(`Missing editable folder file path: ${path}`);

  let currentDirectory = directoryHandle;
  for (const part of parts) {
    currentDirectory = await currentDirectory.getDirectoryHandle(part);
  }

  const fileHandle = await currentDirectory.getFileHandle(fileName);
  const file = await fileHandle.getFile();
  trackFilePath(file, normalizedPath);
  return file;
}

export async function writeFileToEditableFolder(directoryHandle: FileSystemDirectoryHandle, path: string, data: Uint8Array<ArrayBuffer>): Promise<void> {
  const parts = path.split('/').filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) return;

  let currentDirectory = directoryHandle;
  for (const part of parts) {
    currentDirectory = await currentDirectory.getDirectoryHandle(part, { create: true });
  }

  const fileHandle = await currentDirectory.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  try {
    await writable.write(data);
    await writable.close();
  } catch (error) {
    await writable.abort();
    throw error;
  }
}

async function collectEditableFolderFiles(
  directoryHandle: FileSystemDirectoryHandle,
  prefix: string,
  files: File[],
  trackFilePath: (file: File, relativePath: string) => void
): Promise<void> {
  for await (const [name, handle] of directoryHandle.entries()) {
    const relativePath = `${prefix}${name}`;
    if (handle.kind === 'directory') {
      await collectEditableFolderFiles(handle, `${relativePath}/`, files, trackFilePath);
      continue;
    }

    if (handle.kind !== 'file') continue;
    const file = await handle.getFile();
    trackFilePath(file, relativePath);
    files.push(file);
  }
}

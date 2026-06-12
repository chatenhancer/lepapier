import { readFile } from 'node:fs/promises';

export async function readDownloadedTextFile(path: string): Promise<string> {
  return await readFile(path, 'utf8');
}

export async function readDownloadedZipEntries(path: string): Promise<Map<string, Uint8Array>> {
  return parseStoredZipEntries(new Uint8Array(await readFile(path)));
}

export async function readDownloadedZipTextEntries(path: string): Promise<Map<string, string>> {
  const decoder = new TextDecoder();
  const entries = await readDownloadedZipEntries(path);
  return new Map(Array.from(entries, ([entryPath, data]) => [entryPath, decoder.decode(data)]));
}

function parseStoredZipEntries(bytes: Uint8Array): Map<string, Uint8Array> {
  const entries = new Map<string, Uint8Array>();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    const signature = view.getUint32(offset, true);
    if (signature !== 0x04034b50) break;

    const compressionMethod = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const uncompressedSize = view.getUint32(offset + 22, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;

    if (compressionMethod !== 0) {
      throw new Error(`Unsupported compressed ZIP entry at offset ${offset}.`);
    }

    if (dataEnd > bytes.length || compressedSize !== uncompressedSize) {
      throw new Error(`Malformed ZIP entry at offset ${offset}.`);
    }

    const name = new TextDecoder().decode(bytes.slice(nameStart, nameStart + nameLength));
    entries.set(name, bytes.slice(dataStart, dataEnd));
    offset = dataEnd;
  }

  return entries;
}

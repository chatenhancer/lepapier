import { describe, expect, it } from 'vitest';

import { createZip } from './zip';

describe('createZip', () => {
  it('creates an uncompressed ZIP archive with local and central records', async () => {
    const encoder = new TextEncoder();
    const archive = createZip([
      { data: encoder.encode('hello'), path: 'document/index.md' },
      { data: encoder.encode('asset'), path: 'document/assets/image.txt' }
    ]);

    expect(archive.type).toBe('application/zip');

    const bytes = new Uint8Array(await archive.arrayBuffer());
    const view = new DataView(bytes.buffer);
    expect(view.getUint32(0, true)).toBe(0x04034b50);
    expect(view.getUint32(bytes.length - 22, true)).toBe(0x06054b50);
    expect(view.getUint16(bytes.length - 14, true)).toBe(2);
    expect(view.getUint16(bytes.length - 12, true)).toBe(2);
    expect(new TextDecoder().decode(bytes)).toContain('document/index.md');
    expect(new TextDecoder().decode(bytes)).toContain('document/assets/image.txt');
  });
});

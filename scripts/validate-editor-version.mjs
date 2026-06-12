import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import packageJson from '../package.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const targetPath = path.resolve(root, process.argv[2] || 'dist/docs/editor/index.html');
const expectedVersion = packageJson.version;
const html = await readFile(targetPath, 'utf8');

if (!html.includes(`Version: ${expectedVersion}`)) {
  throw new Error(
    `${path.relative(root, targetPath)} does not contain editor build metadata for version ${expectedVersion}.`
  );
}

console.log(`Verified ${path.relative(root, targetPath)} contains editor version ${expectedVersion}.`);

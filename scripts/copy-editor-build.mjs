import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const editorDir = path.join(distDir, 'docs', 'editor');
const editorFiles = ['index.html', 'manifest.webmanifest', 'service-worker.js'];

await mkdir(editorDir, { recursive: true });

for (const fileName of editorFiles) {
  await cp(path.join(distDir, fileName), path.join(editorDir, fileName));
}

const editorIndexPath = path.join(editorDir, 'index.html');
let editorHtml = await readFile(editorIndexPath, 'utf8');
editorHtml = editorHtml.replace(
  '<head>',
  '<head><meta name="robots" content="noindex, nofollow"><link rel="canonical" href="https://lepapier.app/">'
);
await writeFile(editorIndexPath, editorHtml);

console.log(`Copied editor build to ${path.relative(root, editorDir)}`);

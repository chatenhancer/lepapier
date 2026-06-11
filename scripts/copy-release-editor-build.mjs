import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const editorDir = path.join(distDir, 'docs', 'editor');
const source = process.argv[2] || path.join(distDir, 'latest-release');
const zipPath = await resolveZipPath(path.resolve(root, source));

await rm(editorDir, { recursive: true, force: true });

run('unzip', ['-q', zipPath, '-d', editorDir], {
  cwd: root,
  stdio: 'inherit'
});

const editorIndexPath = path.join(editorDir, 'index.html');
let editorHtml = await readFile(editorIndexPath, 'utf8');

if (!editorHtml.includes('name="robots" content="noindex, nofollow"')) {
  editorHtml = editorHtml.replace(
    '<head>',
    '<head><meta name="robots" content="noindex, nofollow"><link rel="canonical" href="https://lepapier.app/">'
  );
  await writeFile(editorIndexPath, editorHtml);
}

console.log(`Copied released editor from ${path.relative(root, zipPath)} to ${path.relative(root, editorDir)}`);

async function resolveZipPath(sourcePath) {
  const sourceStat = await stat(sourcePath).catch(() => null);

  if (!sourceStat) {
    throw new Error(`Release editor source does not exist: ${sourcePath}`);
  }

  if (sourceStat.isFile()) {
    return sourcePath;
  }

  const files = await readdir(sourcePath);
  const zipFiles = files.filter((file) => /^lepapier-\d+\.\d+\.\d+\.zip$/.test(file)).sort();

  if (zipFiles.length !== 1) {
    throw new Error(`Expected exactly one lepapier release zip in ${sourcePath}, found ${zipFiles.length}.`);
  }

  return path.join(sourcePath, zipFiles[0]);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, options);

  if (result.status !== 0) {
    throw new Error(`${command} exited with ${result.status ?? 'unknown status'}`);
  }

  return result;
}

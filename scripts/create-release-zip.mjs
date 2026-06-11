import { spawnSync } from 'node:child_process';
import { access, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import packageJson from '../package.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'dist');
const releaseDir = path.join(distDir, 'release');
const zipPath = path.join(releaseDir, `lepapier-${packageJson.version}.zip`);

await access(path.join(distDir, 'index.html'));
await mkdir(releaseDir, { recursive: true });
await rm(zipPath, { force: true });

run('zip', [
  '-r',
  zipPath,
  '.',
  '-x',
  'docs/*',
  '-x',
  'release/*',
  '-x',
  '.DS_Store',
  '-x',
  '*/.DS_Store'
], {
  cwd: distDir,
  stdio: 'inherit'
});

console.log(`Created ${path.relative(root, zipPath)}`);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, options);

  if (result.status !== 0) {
    throw new Error(`${command} exited with ${result.status ?? 'unknown status'}`);
  }

  return result;
}

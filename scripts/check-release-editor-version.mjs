import { spawnSync } from 'node:child_process';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import packageJson from '../package.json' with { type: 'json' };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(root, process.argv[2] || 'dist/latest-release');
const expectedVersion = packageJson.version;
const result = await resolveZip(source);

if (!result.zipPath) {
  console.log('matches=false');
  console.log(`package_version=${expectedVersion}`);
  console.error(result.reason);
  process.exit(0);
}

const zipVersionMatches = result.version === expectedVersion;
let contentVersionMatches = false;

if (zipVersionMatches) {
  const html = readZipEntry(result.zipPath, 'index.html');
  contentVersionMatches = html.includes(`Version: ${expectedVersion}`);
}

const matches = zipVersionMatches && contentVersionMatches;

console.log(`matches=${matches ? 'true' : 'false'}`);
console.log(`package_version=${expectedVersion}`);
console.log(`release_version=${result.version}`);
console.log(`zip_path=${path.relative(root, result.zipPath)}`);

if (matches) {
  console.error(`Latest release editor matches package version ${expectedVersion}.`);
} else {
  console.error(
    `Latest release editor is ${result.version}; package.json is ${expectedVersion}. Skipping Pages deploy.`
  );
}

async function resolveZip(sourcePath) {
  const sourceStat = await stat(sourcePath).catch(() => null);

  if (!sourceStat) {
    return { reason: `Release editor source does not exist: ${sourcePath}` };
  }

  if (sourceStat.isFile()) {
    const version = versionFromZipName(sourcePath);
    return version
      ? { version, zipPath: sourcePath }
      : { reason: `Release zip name does not match lepapier-X.Y.Z.zip: ${sourcePath}` };
  }

  const files = await readdir(sourcePath);
  const zipFiles = files.filter((file) => /^lepapier-\d+\.\d+\.\d+\.zip$/.test(file)).sort();

  if (zipFiles.length !== 1) {
    return {
      reason: `Expected exactly one lepapier release zip in ${sourcePath}, found ${zipFiles.length}.`
    };
  }

  const zipPath = path.join(sourcePath, zipFiles[0]);
  return { version: versionFromZipName(zipPath), zipPath };
}

function versionFromZipName(zipPath) {
  return /^lepapier-(\d+\.\d+\.\d+)\.zip$/.exec(path.basename(zipPath))?.[1] ?? '';
}

function readZipEntry(zipPath, entryName) {
  const result = spawnSync('unzip', ['-p', zipPath, entryName], {
    cwd: root,
    encoding: 'utf8'
  });

  if (result.status !== 0) {
    throw new Error(`Could not read ${entryName} from ${path.relative(root, zipPath)}.`);
  }

  return result.stdout;
}

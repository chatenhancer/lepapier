import { spawnSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const repository = process.env.GITHUB_REPOSITORY;
const tagName = process.env.GITHUB_REF_NAME;

if (!repository) {
  throw new Error('GITHUB_REPOSITORY is required to generate release notes.');
}

if (!tagName) {
  throw new Error('GITHUB_REF_NAME is required to generate release notes.');
}

const result = spawnSync(
  'gh',
  ['api', `repos/${repository}/releases/generate-notes`, '-f', `tag_name=${tagName}`, '--jq', '.body'],
  {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit']
  }
);

if (result.status !== 0) {
  throw new Error(`gh exited with ${result.status ?? 'unknown status'}`);
}

const notes = result.stdout.replace(/\bFull Changelog\b/g, 'Full changelog');
await writeFile('release-notes.md', notes);

console.log(`Generated release notes for ${tagName}.`);

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const icon = await readFile(path.join(root, 'public', 'assets', 'icons', 'lepapier.svg'), 'utf8');
const outputPath = path.join(root, 'docs', 'public', 'assets', 'social-card.png');
const iconDataUri = `data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}`;
const svg = `
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" fill="#ffffff"/>
  <image href="${iconDataUri}" x="482" y="92" width="236" height="263"/>
  <text x="600" y="440" text-anchor="middle" font-family="Arial, sans-serif" font-size="54" font-weight="700" fill="#000000">Lepapier</text>
  <text x="600" y="506" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" font-weight="400" fill="#000000">no distractions.</text>
</svg>`;

await mkdir(path.dirname(outputPath), { recursive: true });
await writeFile(outputPath, await sharp(Buffer.from(svg)).png().toBuffer());
console.log(`Wrote ${path.relative(root, outputPath)}`);

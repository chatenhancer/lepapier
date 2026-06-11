export function slugify(value: string): string {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function sanitizeFileName(value: string): string {
  const dotIndex = value.lastIndexOf('.');
  const basename = dotIndex > 0 ? value.slice(0, dotIndex) : value;
  const extension = dotIndex > 0 ? value.slice(dotIndex + 1).toLowerCase() : 'png';
  return `${slugify(basename) || 'image'}.${extension.replace(/[^a-z0-9]/g, '') || 'png'}`;
}

export function getFileExtension(fileName: string): string {
  const dotIndex = String(fileName || '').lastIndexOf('.');
  const extension = dotIndex > 0 ? fileName.slice(dotIndex).toLowerCase().replace(/[^.a-z0-9]/g, '') : '.png';
  return extension === '.' ? '.png' : extension;
}

export function dedupeFileName(fileName: string, usedNames: string[]): string {
  const used = new Set(usedNames);
  if (!used.has(fileName)) return fileName;

  const dotIndex = fileName.lastIndexOf('.');
  const basename = dotIndex > 0 ? fileName.slice(0, dotIndex) : fileName;
  const extension = dotIndex > 0 ? fileName.slice(dotIndex) : '';
  let index = 2;
  let candidate = `${basename}-${index}${extension}`;
  while (used.has(candidate)) {
    index += 1;
    candidate = `${basename}-${index}${extension}`;
  }
  return candidate;
}

export function parseTags(value: string): string[] {
  return String(value)
    .split(',')
    .map((tag) => slugify(tag.trim()))
    .filter(Boolean);
}

export function quoteYaml(value: string): string {
  return `"${String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\s*\n\s*/g, ' ')}"`;
}

export function stripMarkdown(value: string): string {
  return String(value)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[#>*_`~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanAiDescription(value: string): string {
  return String(value || '')
    .replace(/^[-*\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

export function cleanAiTitle(value: string): string {
  return String(value || '')
    .replace(/^\s*(title|document title)\s*:\s*/i, '')
    .replace(/^[-*"'\s]+|[-*"'\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90);
}

export function capitalize(value: string): string {
  return String(value || '').replace(/^./, (character) => character.toUpperCase());
}

export function escapeRegExp(value: string): string {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function trimNumber(value: number, maximumFractionDigits: number): string {
  return Number(value).toFixed(maximumFractionDigits).replace(/\.?0+$/, '');
}

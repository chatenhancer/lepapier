import { expect, test } from '@playwright/test';
import {
  bodyInput,
  field,
  openApp,
  togglePreview
} from './helpers/app';
import { readDownloadedZipTextEntries } from './helpers/downloads';
import {
  getWritableFolderWrites,
  installWritableFolderMock
} from './helpers/file-system-access';
import {
  coverFile,
  heroFile,
  importedMarkdownFile
} from './helpers/files';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('opens import menus and imports a markdown file into the workspace', async ({ page }) => {
  await page.locator('[data-open-document]').click();
  await expect(page.locator('[data-open-menu="open"]')).toBeVisible();
  await expect(page.locator('[data-open-document-file-action]')).toHaveText('Markdown file');
  await expect(page.locator('[data-open-document-folder]')).toHaveText('Folder');

  await page.locator('[data-open-editable-folder]').click();
  await expect(page.locator('[data-open-menu="sync"]')).toBeVisible();
  await expect(page.locator('[data-open-editable-file]')).toHaveText('Markdown file');
  await expect(page.locator('[data-open-editable-folder-action]')).toHaveText('Folder');

  await page.locator('[data-open-document-file]').setInputFiles(importedMarkdownFile);

  await expect(page.locator('.document-row')).toHaveCount(2);
  await expect(field(page, 'title')).toHaveValue('Imported File');
  await expect(field(page, 'description')).toHaveValue('Imported description');
  await expect(field(page, 'tags')).toHaveValue('imported, browser');
  await expect(bodyInput(page)).toHaveValue(/## Imported body/);
});

test('sets a cover image and downloads a portable document bundle', async ({ page }) => {
  await field(page, 'title').fill('Cover Download');
  await bodyInput(page).fill('Download body.');

  await page.locator('[data-cover-picker]').setInputFiles(coverFile);
  await expect(page.locator('[data-cover-status]')).toHaveText('Ready');
  await expect(page.locator('[data-cover-path]')).toHaveText('cover.png');

  await togglePreview(page);
  await expect(page.locator('.preview-cover img')).toHaveAttribute('alt', 'Cover Download');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-sidebar] [data-download]').click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/^\d{4}-\d{2}-\d{2}-cover-download\.zip$/);
});

test('imports a folder with shared media only once', async ({ page }) => {
  await installWritableFolderMock(page, {
    path: 'posts/first.md',
    text: [
      '---',
      'title: Folder First',
      '---',
      '',
      '![Shared](../assets/shared.png)',
      '',
      'First folder body.'
    ].join('\n'),
    files: [
      {
        path: 'posts/second.md',
        text: [
          '---',
          'title: Folder Second',
          '---',
          '',
          '![Shared](../assets/shared.png)',
          '',
          'Second folder body.'
        ].join('\n')
      },
      {
        path: 'assets/shared.png',
        text: 'shared image bytes',
        type: 'image/png'
      }
    ]
  });
  await openApp(page);

  await page.locator('[data-open-document]').click();
  await page.locator('[data-open-document-folder]').click();

  await expect(page.locator('[data-save-state]')).toHaveText('Opened documents');
  await expect(page.locator('.document-row')).toHaveCount(3);
  await expect(page.locator('.media-row')).toHaveCount(1);
  await expect(page.locator('.media-row').filter({ hasText: 'shared.png' })).toBeVisible();

  await page.locator('.document-row').filter({ hasText: 'Folder First' }).locator('[data-switch-document]').click();
  await expect(bodyInput(page)).toHaveValue(/!\[Shared\]\(assets\/shared\.png\)/);

  await page.locator('.document-row').filter({ hasText: 'Folder Second' }).locator('[data-switch-document]').click();
  await expect(bodyInput(page)).toHaveValue(/!\[Shared\]\(assets\/shared\.png\)/);
});

test('saves editable folder Markdown and referenced assets back to their source paths', async ({ page }) => {
  await installWritableFolderMock(page, {
    path: 'posts/folder-assets.md',
    text: [
      '---',
      'title: Folder Assets',
      'description: Original folder asset description',
      '---',
      '',
      '![Hero](assets/hero.png)',
      '',
      'Folder asset body.'
    ].join('\n'),
    files: [{
      path: 'posts/assets/hero.png',
      text: 'folder hero bytes',
      type: 'image/png'
    }]
  });
  await openApp(page);

  await page.locator('[data-open-editable-folder]').click();
  await page.locator('[data-open-editable-folder-action]').click();
  await expect(page.locator('[data-save-state]')).toHaveText('Opened and syncing document');

  await field(page, 'description').fill('Updated folder asset description');
  await bodyInput(page).focus();
  await page.keyboard.press('ControlOrMeta+S');

  await expect(page.locator('[data-save-state]')).toHaveText('Saved to folder');
  await expect.poll(() => getWritableFolderWrites(page)).toHaveLength(2);
  const writes = await getWritableFolderWrites(page);
  const markdownWrite = writes.find((write) => write.path === 'posts/folder-assets.md');
  const assetWrite = writes.find((write) => write.path === 'posts/assets/hero.png');

  expect(markdownWrite?.text).toContain('description: "Updated folder asset description"');
  expect(markdownWrite?.text).toContain('![Hero](./assets/hero.png)');
  expect(assetWrite?.text).toBe('folder hero bytes');
});

test('randomizes editable folder synced media filenames when enabled', async ({ page }) => {
  await installWritableFolderMock(page, {
    path: 'posts/folder-randomized-assets.md',
    text: [
      '---',
      'title: Folder Randomized Assets',
      '---',
      '',
      '![Hero](assets/hero.png)',
      '',
      'Folder randomized asset body.'
    ].join('\n'),
    files: [{
      path: 'posts/assets/hero.png',
      text: 'folder hero bytes',
      type: 'image/png'
    }]
  });
  await openApp(page);

  await page.locator('[data-open-editable-folder]').click();
  await page.locator('[data-open-editable-folder-action]').click();
  await expect(page.locator('[data-save-state]')).toHaveText('Opened and syncing document');

  await page.locator('[data-randomize-media-names]').check();
  await bodyInput(page).focus();
  await page.keyboard.press('ControlOrMeta+S');

  await expect(page.locator('[data-save-state]')).toHaveText('Saved to folder');
  await expect.poll(() => getWritableFolderWrites(page)).toHaveLength(2);
  const writes = await getWritableFolderWrites(page);
  const markdownWrite = writes.find((write) => write.path === 'posts/folder-randomized-assets.md');
  const assetWrite = writes.find((write) => write.path !== 'posts/folder-randomized-assets.md');

  expect(assetWrite?.path).toBe('posts/assets/f4defb157b92bfeb.png');
  expect(assetWrite?.path).not.toBe('posts/assets/hero.png');
  expect(markdownWrite?.text).toContain('![Hero](./assets/f4defb157b92bfeb.png)');
  expect(markdownWrite?.text).not.toContain('assets/hero.png)');
  expect(assetWrite?.text).toBe('folder hero bytes');
});

test('downloads only selected documents in a bundle', async ({ page }) => {
  await field(page, 'title').fill('Export First');
  await bodyInput(page).fill('First export body.');
  await page.locator('[data-add-document]').click();
  await field(page, 'title').fill('Export Second');
  await bodyInput(page).fill('Second export body.');
  await page.locator('[data-add-document]').click();
  await field(page, 'title').fill('Export Third');
  await bodyInput(page).fill('Third export body.');

  await page.locator('.document-row').filter({ hasText: 'Export Second' }).locator('[data-select-document]').check();
  await page.locator('.document-row').filter({ hasText: 'Export Third' }).locator('[data-select-document]').check();
  await expect(page.locator('[data-sidebar] [data-download]')).toHaveText('Download selected (2)');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-sidebar] [data-download]').click();
  const download = await downloadPromise;
  const downloadPath = await download.path();

  expect(download.suggestedFilename()).toBe('lepapier-documents.zip');
  expect(downloadPath).toBeTruthy();
  const entries = await readDownloadedZipTextEntries(downloadPath as string);
  const markdown = Array.from(entries.values()).join('\n---entry---\n');

  expect(entries.size).toBe(2);
  expect(markdown).not.toContain('First export body.');
  expect(markdown).toContain('Second export body.');
  expect(markdown).toContain('Third export body.');
});

test('randomizes exported media filenames while keeping Markdown references valid', async ({ page }) => {
  await field(page, 'title').fill('Randomized Media');
  await page.locator('[data-media-picker]').setInputFiles(heroFile);
  await page.locator('.media-row').filter({ hasText: 'hero.png' }).locator('[data-insert-media]').click();
  await page.locator('[data-randomize-media-names]').check();

  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-sidebar] [data-download]').click();
  const download = await downloadPromise;
  const downloadPath = await download.path();

  expect(downloadPath).toBeTruthy();
  const entries = await readDownloadedZipTextEntries(downloadPath as string);
  const markdownEntry = Array.from(entries.entries()).find(([path]) => path.endsWith('.md'));
  const mediaEntry = Array.from(entries.keys()).find((path) => !path.endsWith('.md'));

  expect(markdownEntry).toBeTruthy();
  expect(mediaEntry).toMatch(/^\d{4}-\d{2}-\d{2}-randomized-media-assets\/8391b9fe8155cbe6\.png$/);
  expect(markdownEntry?.[1]).toContain(`(./${mediaEntry})`);
  expect(markdownEntry?.[1]).not.toContain('(hero.png)');
});

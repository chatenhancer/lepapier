import { expect, test } from '@playwright/test';
import {
  bodyInput,
  field,
  getPersistedDraft,
  openApp,
  togglePreview,
  waitForBrowserSave
} from './helpers/app';
import { readDownloadedTextFile } from './helpers/downloads';
import {
  getWritableFileWrites,
  getWritableFolderWrites,
  installDraftWriteFailure,
  installWritableFileMock,
  installWritableFolderMock
} from './helpers/file-system-access';
import {
  coverFile,
  heroFile,
  videoFile
} from './helpers/files';

test('autosaves workspace state and restores the active document after reload', async ({ page }) => {
  await openApp(page);

  await field(page, 'title').fill('Autosaved First');
  await field(page, 'description').fill('First document description');
  await field(page, 'tags').fill('first, saved');
  await bodyInput(page).fill('First document body.');

  await page.locator('[data-add-document]').click();
  await field(page, 'title').fill('Autosaved Second');
  await field(page, 'description').fill('Second document description');
  await field(page, 'tags').fill('second, saved');
  await bodyInput(page).fill('Second document body.');
  await page.locator('[data-randomize-media-names]').check();
  await page.locator('[data-smart-punctuation]').uncheck();
  await togglePreview(page);

  await expect.poll(async () => {
    const draft = await getPersistedDraft(page);
    return {
      activeTitle: draft?.documents.find((document) => document.id === draft.activeDocumentId)?.fields.title,
      documentCount: draft?.documents.length,
      randomizeMediaNames: draft?.randomizeMediaNames,
      smartPunctuation: draft?.smartPunctuation,
      viewMode: draft?.documents.find((document) => document.id === draft.activeDocumentId)?.viewMode
    };
  }).toEqual({
    activeTitle: 'Autosaved Second',
    documentCount: 2,
    randomizeMediaNames: true,
    smartPunctuation: false,
    viewMode: 'preview'
  });

  await page.reload();
  await expect(page.locator('[data-save-state]')).toHaveText('Saved in browser');
  await expect(field(page, 'title')).toHaveValue('Autosaved Second');
  await expect(field(page, 'description')).toHaveValue('Second document description');
  await expect(bodyInput(page)).toHaveValue('Second document body.');
  await expect(page.locator('[data-preview]')).toBeVisible();
  await expect(page.locator('[data-randomize-media-names]')).toBeChecked();
  await expect(page.locator('[data-smart-punctuation]')).not.toBeChecked();

  await page.locator('.document-row').filter({ hasText: 'Autosaved First' }).locator('[data-switch-document]').click();
  await expect(field(page, 'title')).toHaveValue('Autosaved First');
  await expect(field(page, 'description')).toHaveValue('First document description');
  await expect(bodyInput(page)).toHaveValue('First document body.');
});

test('manual save persists immediately and reports browser storage feedback', async ({ page }) => {
  await openApp(page);

  await field(page, 'title').fill('Manual Browser Save');
  await bodyInput(page).fill('Manual save body.');
  await bodyInput(page).focus();
  await page.keyboard.press('ControlOrMeta+S');

  await waitForBrowserSave(page);
  const draft = await getPersistedDraft(page);
  expect(draft?.documents[0]?.fields.title).toBe('Manual Browser Save');
  expect(draft?.documents[0]?.fields.body).toBe('Manual save body.');
});

test('resets the saved local draft after confirmation', async ({ page }) => {
  await openApp(page);

  await field(page, 'title').fill('Reset Me');
  await bodyInput(page).fill('Reset body.');
  await page.locator('[data-cover-picker]').setInputFiles(coverFile);
  await page.locator('[data-media-picker]').setInputFiles([heroFile]);
  await page.locator('[data-add-document]').click();
  await field(page, 'title').fill('Second Reset Doc');
  await page.locator('[data-randomize-media-names]').check();
  await page.locator('[data-smart-punctuation]').uncheck();

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[data-reset]').click();

  await expect(field(page, 'title')).toHaveValue('');
  await expect(page.locator('.document-row')).toHaveCount(1);
  await expect(page.locator('[data-document-count]')).toBeHidden();
  await expect(page.locator('.media-row')).toHaveCount(0);
  await expect(page.locator('[data-cover-status]')).toHaveText('No cover');
  await expect(page.locator('[data-randomize-media-names]')).not.toBeChecked();
  await expect(page.locator('[data-smart-punctuation]')).toBeChecked();
  await expect(bodyInput(page)).toHaveValue(/Start with the change or story that matters\./);

  await expect.poll(async () => {
    const draft = await getPersistedDraft(page);
    return {
      documentCount: draft?.documents.length,
      mediaCount: draft?.media?.length,
      randomizeMediaNames: draft?.randomizeMediaNames,
      smartPunctuation: draft?.smartPunctuation,
      title: draft?.documents[0]?.fields.title
    };
  }).toEqual({
    documentCount: 1,
    mediaCount: 0,
    randomizeMediaNames: false,
    smartPunctuation: true,
    title: ''
  });
});

test('reports browser draft write failures without losing the editor contents', async ({ page }) => {
  await installDraftWriteFailure(page);
  await openApp(page);

  await field(page, 'title').fill('Blocked Draft Save');
  await bodyInput(page).fill('This should stay in the editor even if storage fails.');
  await bodyInput(page).focus();
  await page.keyboard.press('ControlOrMeta+S');

  await expect(page.locator('[data-save-state]')).toHaveText('Could not save in browser');
  await expect(field(page, 'title')).toHaveValue('Blocked Draft Save');
  await expect(bodyInput(page)).toHaveValue('This should stay in the editor even if storage fails.');
  expect(await getPersistedDraft(page)).toBeNull();
});

test('saves cover and media assets for reload restoration', async ({ page }) => {
  await openApp(page);

  await field(page, 'title').fill('Persistent Media');
  await bodyInput(page).fill('Persistent media body.\n\n');
  await page.locator('[data-cover-picker]').setInputFiles(coverFile);
  await page.locator('[data-media-picker]').setInputFiles([heroFile, videoFile]);
  await expect(page.locator('.media-row')).toHaveCount(2);
  await page.locator('.media-row').filter({ hasText: 'hero.png' }).locator('[data-insert-media]').click();
  await page.locator('.media-row').filter({ hasText: 'clip.mp4' }).locator('[data-insert-media]').click();
  await expect(bodyInput(page)).toHaveValue(/!\[hero\]\(hero\.png\)/);
  await expect(bodyInput(page)).toHaveValue(/!\[clip\]\(clip\.mp4\)/);

  await expect.poll(async () => {
    const draft = await getPersistedDraft(page);
    const body = draft?.documents[0]?.fields.body || '';
    return {
      bodyHasClip: body.includes('![clip](clip.mp4)'),
      bodyHasHero: body.includes('![hero](hero.png)'),
      coverPath: draft?.documents[0]?.coverImage?.path,
      mediaCount: draft?.media?.length
    };
  }).toEqual({
    bodyHasClip: true,
    bodyHasHero: true,
    coverPath: 'cover.png',
    mediaCount: 2
  });

  await page.reload();
  await expect(page.locator('[data-save-state]')).toHaveText('Saved in browser');
  await expect(field(page, 'title')).toHaveValue('Persistent Media');
  await expect(page.locator('[data-cover-status]')).toHaveText('Ready');
  await expect(page.locator('[data-cover-path]')).toHaveText('cover.png');
  await expect(page.locator('.media-row')).toHaveCount(2);
  await expect(page.locator('.media-row').filter({ hasText: 'hero.png' })).toBeVisible();
  await expect(page.locator('.media-row').filter({ hasText: 'clip.mp4' })).toBeVisible();
  await expect(bodyInput(page)).toHaveValue(/!\[hero\]\(hero\.png\)/);
  await expect(bodyInput(page)).toHaveValue(/!\[clip\]\(clip\.mp4\)/);
});

test('downloads the current unsaved editor state as Markdown', async ({ page }) => {
  await openApp(page);

  await field(page, 'title').fill('Download Fresh State');
  await field(page, 'description').fill('Description saved into the exported Markdown');
  await field(page, 'tags').fill('download, fresh');
  await bodyInput(page).fill('The latest body should be in the downloaded file.');

  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-sidebar] [data-download]').click();
  const download = await downloadPromise;
  const downloadPath = await download.path();

  expect(download.suggestedFilename()).toMatch(/^\d{4}-\d{2}-\d{2}-download-fresh-state\.md$/);
  expect(downloadPath).toBeTruthy();
  const markdown = await readDownloadedTextFile(downloadPath as string);
  expect(markdown).toContain('title: "Download Fresh State"');
  expect(markdown).toContain('description: "Description saved into the exported Markdown"');
  expect(markdown).toContain('  - "download"');
  expect(markdown).toContain('  - "fresh"');
  expect(markdown).toContain('The latest body should be in the downloaded file.');
});

test('saves edits back to an opened writable Markdown file', async ({ page }) => {
  await installWritableFileMock(page, {
    name: 'synced-file.md',
    text: [
      '---',
      'title: Synced File',
      'description: File sync source',
      'tags: file',
      '---',
      '',
      'Original file body.'
    ].join('\n')
  });
  await openApp(page);

  await page.locator('[data-open-editable-folder]').click();
  await page.locator('[data-open-editable-file]').click();
  await expect(page.locator('[data-save-state]')).toHaveText('Opened and syncing document');
  await expect(field(page, 'title')).toHaveValue('Synced File');

  await field(page, 'description').fill('Updated file description');
  await bodyInput(page).fill('Updated file body.');
  await bodyInput(page).focus();
  await page.keyboard.press('ControlOrMeta+S');

  await expect(page.locator('[data-save-state]')).toHaveText('Saved to file');
  await expect.poll(() => getWritableFileWrites(page)).toHaveLength(1);
  const [write] = await getWritableFileWrites(page);
  expect(write.name).toBe('synced-file.md');
  expect(write.text).toContain('title: "Synced File"');
  expect(write.text).toContain('description: "Updated file description"');
  expect(write.text).toContain('Updated file body.');
});

test('saves focused preview text edits back to an opened writable Markdown file', async ({ page }) => {
  await installWritableFileMock(page, {
    name: 'focused-preview-file.md',
    text: [
      '---',
      'title: Focused Preview File',
      'description: File sync source',
      'tags: file',
      '---',
      '',
      'Original preview body.'
    ].join('\n')
  });
  await openApp(page);

  await page.locator('[data-open-editable-folder]').click();
  await page.locator('[data-open-editable-file]').click();
  await expect(page.locator('[data-save-state]')).toHaveText('Opened and syncing document');
  await togglePreview(page);

  const paragraph = page.locator('.preview-body p').first();
  await paragraph.fill('Focused preview body.');
  await expect(paragraph).toBeFocused();
  await page.keyboard.press('ControlOrMeta+S');

  await expect(page.locator('[data-save-state]')).toHaveText('Saved to file');
  await expect.poll(() => getWritableFileWrites(page)).toHaveLength(1);
  const [write] = await getWritableFileWrites(page);
  expect(write.name).toBe('focused-preview-file.md');
  expect(write.text).toContain('Focused preview body.');
});

test('saves edits back to the original path in an opened writable folder', async ({ page }) => {
  await installWritableFolderMock(page, {
    path: 'posts/folder-note.md',
    text: [
      '---',
      'title: Folder Note',
      'description: Folder sync source',
      'tags: folder',
      '---',
      '',
      'Original folder body.'
    ].join('\n')
  });
  await openApp(page);

  await page.locator('[data-open-editable-folder]').click();
  await page.locator('[data-open-editable-folder-action]').click();
  await expect(page.locator('[data-save-state]')).toHaveText('Opened and syncing document');
  await expect(field(page, 'title')).toHaveValue('Folder Note');

  await field(page, 'description').fill('Updated folder description');
  await bodyInput(page).fill('Updated folder body.');
  await bodyInput(page).focus();
  await page.keyboard.press('ControlOrMeta+S');

  await expect(page.locator('[data-save-state]')).toHaveText('Saved to folder');
  await expect.poll(() => getWritableFolderWrites(page)).toHaveLength(1);
  const [write] = await getWritableFolderWrites(page);
  expect(write.path).toBe('posts/folder-note.md');
  expect(write.text).toContain('title: "Folder Note"');
  expect(write.text).toContain('description: "Updated folder description"');
  expect(write.text).toContain('Updated folder body.');
});

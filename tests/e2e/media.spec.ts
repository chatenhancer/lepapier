import { expect, test } from '@playwright/test';
import {
  bodyInput,
  clickPreviewImageAction,
  openApp,
  togglePreview
} from './helpers/app';
import {
  createFixturePayload,
  dropFiles,
  pasteFiles
} from './helpers/media-events';
import {
  heroFile,
  videoFile
} from './helpers/files';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('adds media, inserts images and videos, previews video, edits image controls, and deletes images from preview', async ({ page }) => {
  await page.locator('[data-media-picker]').setInputFiles([heroFile, videoFile]);
  await expect(page.locator('.media-row')).toHaveCount(2);
  await expect(page.locator('.media-row video')).toHaveCount(1);

  await page.locator('.media-row').filter({ hasText: 'hero.png' }).locator('[data-insert-media]').click();
  await page.locator('.media-row').filter({ hasText: 'clip.mp4' }).locator('[data-insert-media]').click();
  await expect(bodyInput(page)).toHaveValue(/!\[hero\]\(hero\.png\)/);
  await expect(bodyInput(page)).toHaveValue(/!\[clip\]\(clip\.mp4\)/);

  await togglePreview(page);
  await expect(page.locator('.preview-image-frame')).toHaveCount(1);
  await expect(page.locator('.preview-video-frame video[controls]')).toHaveCount(1);

  await clickPreviewImageAction(page, '[data-image-align-center]');
  await expect(bodyInput(page)).toHaveValue(/align=center/);

  await clickPreviewImageAction(page, '[data-image-shadow-toggle]');
  await expect(bodyInput(page)).toHaveValue(/shadow=smooth/);

  await clickPreviewImageAction(page, '[data-image-crop-toggle]');
  await expect(bodyInput(page)).toHaveValue(/crop=16:9/);

  await clickPreviewImageAction(page, '[data-image-display-inline]');
  await expect(bodyInput(page)).toHaveValue(/display=inline/);

  await page.locator('.preview-image-frame').click();
  await page.keyboard.press('Delete');
  await expect(bodyInput(page)).not.toHaveValue(/hero\.png/);
  await expect(bodyInput(page)).toHaveValue(/clip\.mp4/);
});

test('inserts dropped and pasted media into the editor', async ({ page }) => {
  const droppedImage = await createFixturePayload(heroFile, {
    name: 'dropped-hero.png',
    type: 'image/png'
  });
  const pastedVideo = await createFixturePayload(videoFile, {
    name: 'pasted-clip.mp4',
    type: 'video/mp4'
  });

  await dropFiles(page.locator('.paper'), [droppedImage]);
  await expect(bodyInput(page)).toHaveValue(/!\[dropped hero\]\(dropped-hero\.png\)/);
  await expect(page.locator('.media-row').filter({ hasText: 'dropped-hero.png' })).toBeVisible();

  await bodyInput(page).focus();
  await pasteFiles(page, [pastedVideo]);
  await expect(bodyInput(page)).toHaveValue(/!\[pasted clip\]\(pasted-clip\.mp4\)/);
  await expect(page.locator('.media-row').filter({ hasText: 'pasted-clip.mp4' })).toBeVisible();
});

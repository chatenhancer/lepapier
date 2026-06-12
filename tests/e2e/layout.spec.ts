import { expect, test, type Locator } from '@playwright/test';
import {
  bodyInput,
  expectReady,
  field,
  getPersistedDraft,
  openApp,
  paperWidth
} from './helpers/app';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('opens mobile panels and resizes the writing sheet from its edge', async ({ page }) => {
  await page.setViewportSize({ height: 800, width: 390 });
  await page.reload();
  await expectReady(page);

  await page.locator('[data-mobile-panel-toggle="documents"]').click();
  await expect(page.locator('body')).toHaveClass(/is-documents-panel-open/);
  await expect(page.locator('[data-mobile-panel-toggle="documents"]')).toHaveAttribute('aria-expanded', 'true');

  await page.locator('[data-mobile-panel-toggle="settings"]').click();
  await expect(page.locator('body')).toHaveClass(/is-settings-panel-open/);
  await expect(page.locator('body')).not.toHaveClass(/is-documents-panel-open/);

  await page.setViewportSize({ height: 900, width: 1280 });
  await expect(page.locator('body')).not.toHaveClass(/is-settings-panel-open/);

  const paper = page.locator('.paper');
  const before = await paperWidth(paper);
  const box = await paper.boundingBox();
  if (!box) throw new Error('Paper bounding box was unavailable.');

  await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2);
  await expect(paper).toHaveClass(/is-resize-right-visible/);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width + 80, box.y + box.height / 2);
  await page.mouse.up();

  await expect.poll(() => paperWidth(paper)).toBeGreaterThan(before + 40);
});

test('keeps desktop sidebars and writing sheet from overlapping', async ({ page }) => {
  await page.setViewportSize({ height: 900, width: 1440 });
  await page.reload();
  await expectReady(page);

  const documents = await boundingRect(page.locator('[data-documents-sidebar]'));
  const paper = await boundingRect(page.locator('.paper'));
  const settings = await boundingRect(page.locator('[data-sidebar]'));

  expect(documents.right).toBeLessThanOrEqual(paper.left);
  expect(paper.right).toBeLessThanOrEqual(settings.left);
  expect(paper.left).toBeGreaterThanOrEqual(0);
  expect(settings.right).toBeLessThanOrEqual(1440);
});

test('keeps mobile panels inside the viewport without stacking both panels', async ({ page }) => {
  await page.setViewportSize({ height: 820, width: 390 });
  await page.reload();
  await expectReady(page);

  const closedPaper = await boundingRect(page.locator('.paper'));
  expect(closedPaper.left).toBeGreaterThanOrEqual(0);
  expect(closedPaper.right).toBeLessThanOrEqual(390);

  await page.locator('[data-mobile-panel-toggle="documents"]').click();
  await expect(page.locator('body')).toHaveClass(/is-documents-panel-open/);
  await expect.poll(() => boundingRect(page.locator('[data-documents-sidebar]')).then((rect) => rect.left)).toBeGreaterThanOrEqual(0);
  const openDocuments = await boundingRect(page.locator('[data-documents-sidebar]'));
  const closedSettings = await boundingRect(page.locator('[data-sidebar]'));
  expect(openDocuments.left).toBeGreaterThanOrEqual(0);
  expect(openDocuments.right).toBeLessThanOrEqual(390);
  expect(closedSettings.left).toBeGreaterThanOrEqual(390);

  await page.locator('[data-mobile-panel-toggle="settings"]').click();
  await expect(page.locator('body')).toHaveClass(/is-settings-panel-open/);
  await expect.poll(() => boundingRect(page.locator('[data-sidebar]')).then((rect) => rect.right)).toBeLessThanOrEqual(390);
  const closedDocuments = await boundingRect(page.locator('[data-documents-sidebar]'));
  const openSettings = await boundingRect(page.locator('[data-sidebar]'));
  expect(closedDocuments.right).toBeLessThanOrEqual(0);
  expect(openSettings.left).toBeGreaterThanOrEqual(0);
  expect(openSettings.right).toBeLessThanOrEqual(390);
});

test('supports mobile metadata, body edits, document switching, and autosave', async ({ page }) => {
  await page.setViewportSize({ height: 820, width: 390 });
  await page.reload();
  await expectReady(page);

  await page.locator('[data-mobile-panel-toggle="settings"]').click();
  await field(page, 'title').fill('Mobile First');
  await field(page, 'description').fill('Edited from the mobile settings panel.');
  await page.locator('[data-mobile-panel-toggle="settings"]').click();
  await bodyInput(page).fill('Mobile first body.');

  await page.locator('[data-mobile-panel-toggle="documents"]').click();
  await page.locator('[data-add-document]').click();
  await page.keyboard.press('Escape');
  await bodyInput(page).fill('Mobile second body.');
  await page.locator('[data-mobile-panel-toggle="settings"]').click();
  await field(page, 'title').fill('Mobile Second');
  await page.locator('[data-mobile-panel-toggle="settings"]').click();

  await page.locator('[data-mobile-panel-toggle="documents"]').click();
  await page.locator('.document-row').filter({ hasText: 'Mobile First' }).locator('[data-switch-document]').click();
  await expect(page.locator('body')).not.toHaveClass(/is-documents-panel-open/);
  await expect(field(page, 'title')).toHaveValue('Mobile First');
  await expect(bodyInput(page)).toHaveValue('Mobile first body.');

  await expect.poll(async () => {
    const draft = await getPersistedDraft(page);
    return draft?.documents.map((document) => document.fields.title).sort();
  }).toEqual(['Mobile First', 'Mobile Second']);
});

type BoundingRect = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

async function boundingRect(locator: Locator): Promise<BoundingRect> {
  const box = await locator.boundingBox();
  if (!box) throw new Error('Expected element to have a bounding box.');

  return {
    bottom: box.y + box.height,
    left: box.x,
    right: box.x + box.width,
    top: box.y
  };
}

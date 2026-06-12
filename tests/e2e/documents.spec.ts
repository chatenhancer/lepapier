import { expect, test } from '@playwright/test';
import {
  bodyInput,
  field,
  openApp
} from './helpers/app';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('manages documents, selection, switching, and removal without deleting source files', async ({ page }) => {
  await page.locator('[data-add-document]').click();
  await field(page, 'title').fill('Second document');
  await page.locator('[data-add-document]').click();
  await field(page, 'title').fill('Third document');

  await expect(page.locator('.document-row')).toHaveCount(3);
  await expect(page.locator('[data-document-count]')).toBeVisible();
  await expect(page.locator('[data-document-count]')).toHaveText('3');

  await page.locator('.document-row').first().locator('[data-switch-document]').click();
  await expect(field(page, 'title')).toHaveValue('');

  await page.locator('[data-select-all-documents]').check();
  await expect(page.locator('[data-delete-selected]')).toBeVisible();
  await expect(page.locator('[data-delete-selected]')).toHaveText('Remove selected (3)');

  page.once('dialog', (dialog) => dialog.accept());
  await page.locator('[data-delete-selected]').click();

  await expect(page.locator('.document-row')).toHaveCount(1);
  await expect(page.locator('[data-document-count]')).toBeHidden();
  await expect(page.locator('[data-delete-selected]')).toBeHidden();
  await expect(bodyInput(page)).toBeVisible();
});

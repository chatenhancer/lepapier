import { expect, test } from '@playwright/test';
import {
  bodyInput,
  expectReady,
  field,
  getPersistedBody,
  openApp,
  placeCursorAtEnd
} from './helpers/app';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('edits metadata, normalizes smart punctuation, copies diagnostics, toggles theme, and persists locally', async ({ page }) => {
  await field(page, 'title').fill('Quiet Launch Notes');
  await expect(field(page, 'slug')).toHaveValue('quiet-launch-notes');

  await page.locator('[data-smart-punctuation]').uncheck();
  await field(page, 'description').fill('"Draft" summary');
  await bodyInput(page).fill('Body with "quotes".');
  await page.locator('[data-smart-punctuation-replace]').click();

  await expect(field(page, 'description')).toHaveValue('«Draft» summary');
  await expect(bodyInput(page)).toHaveValue('Body with «quotes».');
  await expect(page.locator('[data-output]')).toContainText('title: "Quiet Launch Notes"');
  await expect(page.locator('[data-output]')).toContainText('Body with «quotes».');

  await expect(page.locator('[data-app-version]')).toContainText(/^lepapier\.app v\d+\.\d+\.\d+$/);
  await expect(page.locator('[data-app-release-notes]')).toHaveAttribute('href', /github\.com\/chatenhancer\/lepapier\/releases/);

  await page.locator('[data-copy-bug-report]').click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain('Lepapier bug report');

  await page.locator('[data-theme-toggle]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await expect.poll(() => getPersistedBody(page)).toBe('Body with «quotes».');
  await page.reload();
  await expectReady(page);
  await expect(field(page, 'title')).toHaveValue('Quiet Launch Notes');
  await expect(field(page, 'slug')).toHaveValue('quiet-launch-notes');
  await expect(bodyInput(page)).toHaveValue('Body with «quotes».');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

test('undoes and redoes editor toolbar changes', async ({ page }) => {
  await bodyInput(page).fill('Undo base');
  await placeCursorAtEnd(bodyInput(page));

  await page.locator('[data-insert="bold"]').click();
  await expect(bodyInput(page)).toHaveValue(/Undo base\*\*bold text\*\*/);

  await bodyInput(page).focus();
  await page.keyboard.press('ControlOrMeta+Z');
  await expect(bodyInput(page)).toHaveValue('Undo base');

  await page.keyboard.press('ControlOrMeta+Shift+Z');
  await expect(bodyInput(page)).toHaveValue(/Undo base\*\*bold text\*\*/);
});

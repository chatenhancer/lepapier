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

test('keeps write-mode scroll position while typing in a long document', async ({ page }) => {
  await page.setViewportSize({ height: 720, width: 1280 });

  const lines = Array.from({ length: 180 }, (_value, index) => `Line ${index + 1}`);
  const body = lines.join('\n');
  const targetLine = 100;
  const targetText = `Line ${targetLine}`;
  const targetOffset = body.indexOf(targetText) + targetText.length;

  await bodyInput(page).fill(body);
  await bodyInput(page).evaluate((element, offset) => {
    if (!(element instanceof HTMLTextAreaElement)) return;

    element.focus({ preventScroll: true });
    element.setSelectionRange(offset, offset);
  }, targetOffset);

  const scrollBeforeTyping = await page.evaluate((lineNumber) => {
    const input = document.querySelector<HTMLTextAreaElement>('[data-field="body"]');
    if (!input) return window.scrollY;

    const style = window.getComputedStyle(input);
    const lineHeight = Number.parseFloat(style.lineHeight) || 28;
    const inputTop = input.getBoundingClientRect().top + window.scrollY;
    window.scrollTo(0, Math.round(inputTop + ((lineNumber - 1) * lineHeight) - 220));
    return window.scrollY;
  }, targetLine);

  await page.keyboard.type(' typed');

  await expect.poll(() => page.evaluate((expectedScrollY) => {
    return Math.abs(window.scrollY - expectedScrollY);
  }, scrollBeforeTyping)).toBeLessThanOrEqual(1);
  await expect(bodyInput(page)).toHaveValue(body.replace(targetText, `${targetText} typed`));
});

test('scrolls the write-mode cursor into view for toolbar insertions', async ({ page }) => {
  await page.setViewportSize({ height: 720, width: 1280 });

  const body = Array.from({ length: 180 }, (_value, index) => `Line ${index + 1}`).join('\n');
  await bodyInput(page).fill(body);
  await bodyInput(page).evaluate((element) => {
    if (!(element instanceof HTMLTextAreaElement)) return;

    element.focus({ preventScroll: true });
    element.setSelectionRange(element.value.length, element.value.length);
  });
  await page.evaluate(() => window.scrollTo(0, 0));

  const scrollBeforeToolbar = await page.evaluate(() => window.scrollY);
  await page.locator('[data-insert="bold"]').click();

  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(scrollBeforeToolbar + 200);
  await expect(bodyInput(page)).toHaveValue(/Line 180\*\*bold text\*\*/);
});

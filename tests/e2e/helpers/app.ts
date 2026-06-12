import { expect, type Locator, type Page } from '@playwright/test';
import type { WorkspaceDraft } from '../../../src/shared/types';

export async function openApp(page: Page): Promise<void> {
  await page.goto('/');
  await expectReady(page);
}

export async function expectReady(page: Page): Promise<void> {
  await expect(bodyInput(page)).toBeVisible();
  await expect(page.locator('[data-save-state]')).toHaveText('Saved in browser');
}

export function bodyInput(page: Page): Locator {
  return page.locator('[data-field="body"]');
}

export function field(page: Page, name: string): Locator {
  return page.locator(`[data-field="${name}"]`);
}

export async function togglePreview(page: Page): Promise<void> {
  await page.locator('[data-preview-toggle]').click();
  await expect(page.locator('[data-preview]')).toBeVisible();
}

export async function clickPreviewImageAction(page: Page, selector: string): Promise<void> {
  const frame = page.locator('.preview-image-frame');
  await frame.click();
  await frame.locator(selector).click();
}

export async function replaceEditableText(locator: Locator, text: string): Promise<void> {
  await locator.evaluate((element, nextText) => {
    if (!(element instanceof HTMLElement)) return;
    element.focus();
    element.dispatchEvent(new InputEvent('beforeinput', {
      bubbles: true,
      cancelable: true,
      data: nextText,
      inputType: 'insertText'
    }));
    element.textContent = nextText;
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      data: nextText,
      inputType: 'insertText'
    }));
    element.blur();
    element.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  }, text);
}

export async function placeCursorAtEnd(locator: Locator): Promise<void> {
  await locator.evaluate((element) => {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return;
    element.focus();
    element.setSelectionRange(element.value.length, element.value.length);
  });
}

export async function paperWidth(paper: Locator): Promise<number> {
  return paper.evaluate((element) => element.getBoundingClientRect().width);
}

export async function getPersistedBody(page: Page): Promise<string> {
  const draft = await getPersistedDraft(page);
  return draft?.documents?.[0]?.fields?.body || '';
}

export async function getPersistedDraft(page: Page): Promise<WorkspaceDraft | null> {
  return page.evaluate(() => JSON.parse(localStorage.getItem('lepapier-draft-v1') || 'null') as WorkspaceDraft | null);
}

export async function waitForBrowserSave(page: Page): Promise<void> {
  await expect(page.locator('[data-save-state]')).toHaveText('Saved in browser');
}

import { readFile } from 'node:fs/promises';
import type { Locator, Page } from '@playwright/test';

export interface BrowserFilePayload {
  bytes: number[];
  name: string;
  type: string;
}

export async function createFixturePayload(path: string, { name, type }: { name: string; type: string }): Promise<BrowserFilePayload> {
  return {
    bytes: Array.from(new Uint8Array(await readFile(path))),
    name,
    type
  };
}

export async function dropFiles(locator: Locator, files: BrowserFilePayload[]): Promise<void> {
  await locator.dispatchEvent('drop', {
    dataTransfer: await locator.page().evaluateHandle((payloads) => {
      const dataTransfer = new DataTransfer();
      for (const payload of payloads) {
        dataTransfer.items.add(new File([new Uint8Array(payload.bytes)], payload.name, { type: payload.type }));
      }
      return dataTransfer;
    }, files)
  });
}

export async function pasteFiles(page: Page, files: BrowserFilePayload[]): Promise<void> {
  await page.evaluate((payloads) => {
    const dataTransfer = new DataTransfer();
    for (const payload of payloads) {
      dataTransfer.items.add(new File([new Uint8Array(payload.bytes)], payload.name, { type: payload.type }));
    }
    document.activeElement?.dispatchEvent(new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData: dataTransfer
    }));
  }, files);
}

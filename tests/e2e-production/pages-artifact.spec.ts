import { expect, test, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const editorServiceWorkerPath = path.resolve('dist/docs/editor/service-worker.js');
const packageJson = JSON.parse(readFileSync(path.resolve('package.json'), 'utf8')) as { version: string };
const releaseZipPath = path.resolve(`dist/release/lepapier-${packageJson.version}.zip`);

type WebManifest = {
  background_color: string;
  description: string;
  display: string;
  icons: Array<{
    purpose: string;
    sizes: string;
    src: string;
    type: string;
  }>;
  id: string;
  name: string;
  scope: string;
  short_name: string;
  start_url: string;
  theme_color: string;
};

test('serves the landing page and editor from the built Pages artifact', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Lepapier/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://lepapier.app/');
  await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', 'https://lepapier.app/');
  await expect(page.getByRole('link', { name: /Start writing/i })).toHaveAttribute('href', '/editor/');

  await page.getByRole('link', { name: /Start writing/i }).click();
  await expect(page).toHaveURL(/\/editor\/$/);
  await expect(page.locator('[data-save-state]')).toHaveText('Saved in browser');
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest.webmanifest');
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', 'https://lepapier.app/');

  await expect.poll(async () => (await page.request.get('/editor/manifest.webmanifest')).ok()).toBe(true);
  await expect.poll(async () => (await page.request.get('/editor/service-worker.js')).ok()).toBe(true);
});

test('serves editor deep links and reloads from the Pages artifact', async ({ page }) => {
  await page.goto('/editor/');
  await expectEditorReady(page);
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href', 'manifest.webmanifest');

  await page.reload();
  await expect(page).toHaveURL(/\/editor\/$/);
  await expectEditorReady(page);

  const editorResponse = await page.request.get('/editor/');
  expect(editorResponse.ok()).toBe(true);
  expect(await editorResponse.text()).toContain('<title>Lepapier</title>');
});

test('ships a production PWA manifest with generated app icons', async ({ page }) => {
  const manifestResponse = await page.request.get('/editor/manifest.webmanifest');
  expect(manifestResponse.ok()).toBe(true);

  const manifest = await manifestResponse.json() as WebManifest;
  expect(manifest).toMatchObject({
    background_color: '#ffffff',
    description: 'A local-first Markdown writing app.',
    display: 'standalone',
    id: '.',
    name: 'Lepapier',
    scope: '.',
    short_name: 'Lepapier',
    start_url: '.',
    theme_color: '#ffffff'
  });
  expect(manifest.icons).toEqual([
    {
      src: 'pwa-icon-192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any'
    },
    {
      src: 'pwa-icon-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any'
    },
    {
      src: 'pwa-maskable-512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable'
    }
  ]);

  for (const icon of manifest.icons) {
    const iconResponse = await page.request.get(`/editor/${icon.src}`);
    expect(iconResponse.ok()).toBe(true);
    expect(iconResponse.headers()['content-type']).toContain('image/png');
  }
});

test('updates the real production service worker silently and preserves work after reload', async ({ page }) => {
  const originalServiceWorker = await readFile(editorServiceWorkerPath, 'utf8');

  try {
    await page.goto('/editor/');
    await waitForServiceWorkerController(page);

    await page.reload();
    await expectEditorReady(page);
    await expect(page.locator('[data-pwa-update]')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);

    await page.locator('[data-field="title"]').fill('Production PWA Draft');
    await page.locator('[data-field="body"]').fill('This draft should survive a production service worker update.');
    await expect.poll(() => page.evaluate(() => localStorage.getItem('lepapier-draft-v1') || '')).toContain('Production PWA Draft');

    await triggerProductionServiceWorkerUpdate(page, originalServiceWorker, 'preserve-work');

    await expect(page.locator('[data-pwa-update]')).toHaveCount(0);

    await page.evaluate(() => {
      sessionStorage.removeItem('lepapier-production-update-reload');
      window.addEventListener('beforeunload', () => {
        sessionStorage.setItem('lepapier-production-update-reload', 'true');
      }, { once: true });
    });

    await page.reload();
    await page.waitForLoadState('load');
    await expectEditorReady(page);
    await expect(page.locator('[data-field="title"]')).toHaveValue('Production PWA Draft');
    await expect(page.locator('[data-field="body"]')).toHaveValue('This draft should survive a production service worker update.');
    await expect.poll(() => page.evaluate(() => sessionStorage.getItem('lepapier-production-update-reload'))).toBe('true');
  } finally {
    await writeFile(editorServiceWorkerPath, originalServiceWorker);
  }
});

test('creates a release zip with the portable app shell only', async () => {
  execFileSync(getNpmCommand(), ['run', 'release:zip'], {
    cwd: path.resolve('.'),
    stdio: 'pipe'
  });

  const entries = listZipEntries(releaseZipPath);

  expect(entries).toContain('index.html');
  expect(entries).toContain('manifest.webmanifest');
  expect(entries).toContain('service-worker.js');
  expect(entries).toContain('pwa-icon-192.png');
  expect(entries).toContain('pwa-icon-512.png');
  expect(entries).toContain('pwa-maskable-512.png');
  expect(entries.some((entry) => entry.startsWith('docs/'))).toBe(false);
  expect(entries.some((entry) => entry.startsWith('release/'))).toBe(false);
  expect(entries.some((entry) => entry.startsWith('src/'))).toBe(false);
  expect(entries.some((entry) => entry.startsWith('tests/'))).toBe(false);
  expect(entries.some((entry) => entry.startsWith('test-results/'))).toBe(false);
  expect(entries.some((entry) => entry.startsWith('playwright-report/'))).toBe(false);

  const manifest = JSON.parse(readZipText(releaseZipPath, 'manifest.webmanifest')) as WebManifest;
  expect(manifest.start_url).toBe('.');
  expect(manifest.scope).toBe('.');
  expect(manifest.display).toBe('standalone');
});

async function expectEditorReady(page: Page): Promise<void> {
  await expect(page.locator('[data-field="body"]')).toBeVisible();
  await expect(page.locator('[data-save-state]')).toHaveText('Saved in browser');
}

async function waitForServiceWorkerController(page: Page): Promise<void> {
  await page.evaluate(async () => {
    if (navigator.serviceWorker.controller) return;

    await new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
    });
  });
}

async function triggerProductionServiceWorkerUpdate(page: Page, serviceWorkerSource: string, label: string): Promise<void> {
  const updatedServiceWorker = serviceWorkerSource.replace(
    /const CACHE_NAME="([^"]+)"/,
    `const CACHE_NAME="$1-e2e-${label}-${Date.now()}"`
  );

  if (updatedServiceWorker === serviceWorkerSource) {
    throw new Error('Could not update the production service worker cache name.');
  }

  await writeFile(editorServiceWorkerPath, `${updatedServiceWorker}\n// e2e service worker update\n`);

  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) throw new Error('Service worker registration was unavailable.');
    const controllerChanged = new Promise<void>((resolve) => {
      navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true });
    });
    await registration.update();
    await controllerChanged;
  });
}

function listZipEntries(zipPath: string): string[] {
  return execFileSync('unzip', ['-Z1', zipPath], { encoding: 'utf8' })
    .split('\n')
    .map(normalizeZipEntry)
    .filter(Boolean);
}

function readZipText(zipPath: string, entryPath: string): string {
  return execFileSync('unzip', ['-p', zipPath, entryPath], { encoding: 'utf8' });
}

function normalizeZipEntry(entry: string): string {
  return entry.trim().replace(/^\.\//, '').replace(/\/$/, '');
}

function getNpmCommand(): string {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

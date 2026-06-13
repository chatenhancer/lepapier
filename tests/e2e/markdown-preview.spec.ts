import { expect, test } from '@playwright/test';
import {
  bodyInput,
  field,
  openApp,
  placeEditableCursorAtEnd,
  replaceEditableText,
  togglePreview
} from './helpers/app';

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('inserts every toolbar block and renders supported markdown in preview', async ({ page }) => {
  await bodyInput(page).fill('');
  await bodyInput(page).focus();

  for (const tool of [
    'heading',
    'bold',
    'italic',
    'strike',
    'quote',
    'list',
    'ordered-list',
    'task-list',
    'link',
    'image',
    'rule',
    'table',
    'code'
  ]) {
    await page.locator(`[data-insert="${tool}"]`).click();
  }

  const toolbarValue = await bodyInput(page).inputValue();
  for (const snippet of [
    '## Section heading',
    '**bold text**',
    '*italic text*',
    '~~removed text~~',
    '> Quote',
    '- List item',
    '1. List item',
    '- [ ] Task',
    '[Link text](https://example.com)',
    '![Alt text](image.png)',
    '---',
    '| Column | Value |',
    '`code`'
  ]) {
    expect(toolbarValue).toContain(snippet);
  }

  await bodyInput(page).fill([
    '## Heading',
    '',
    '**Bold** and *italic* and ~~removed~~.',
    '',
    '> Quote',
    '',
    '- Bullet',
    '1. Ordered',
    '- [x] Done',
    '- [ ] Open',
    '',
    '[Example](https://example.com)',
    '',
    '---',
    '',
    '| Name | Count |',
    '| --- | ---: |',
    '| Paper | 3 |',
    '',
    '`inline code`'
  ].join('\n'));
  await togglePreview(page);

  await expect(page.locator('[data-preview] h2')).toHaveText('Heading');
  await expect(page.locator('[data-preview] strong')).toContainText('Bold');
  await expect(page.locator('[data-preview] em')).toContainText('italic');
  await expect(page.locator('[data-preview] s')).toContainText('removed');
  await expect(page.locator('[data-preview] blockquote')).toContainText('Quote');
  await expect(page.locator('[data-preview] ul li')).toContainText(['Bullet', 'Done', 'Open']);
  await expect(page.locator('[data-preview] ol li')).toContainText('Ordered');
  await expect(page.locator('[data-preview] input[type="checkbox"]')).toHaveCount(2);
  await expect(page.locator('[data-preview] a[href="https://example.com"]')).toHaveText('Example');
  await expect(page.locator('[data-preview] hr')).toHaveCount(1);
  await expect(page.locator('[data-preview] table')).toBeVisible();
  await expect(page.locator('[data-preview] code')).toContainText('inline code');
});

test('edits preview text and table cells, tabs between cells, and adds rows and columns', async ({ page }) => {
  await field(page, 'title').fill('Preview title');
  await bodyInput(page).fill([
    '| Column | Value |',
    '| --- | --- |',
    '| Item | Detail |'
  ].join('\n'));
  await togglePreview(page);

  const previewTitle = page.locator('[data-preview-field="title"]');
  await previewTitle.fill('Edited Preview Title');
  await previewTitle.press('Enter');
  await expect(field(page, 'title')).toHaveValue('Edited Preview Title');
  await expect(field(page, 'slug')).toHaveValue('edited-preview-title');

  const firstCell = page.locator('td[data-table-row="1"][data-table-column="0"]');
  const secondCell = page.locator('td[data-table-row="1"][data-table-column="1"]');
  await firstCell.fill('Item 2');
  await firstCell.press('Tab');
  await expect(secondCell).toBeFocused();
  await expect(bodyInput(page)).toHaveValue(/\| Item 2 \| Detail \|/);

  await page.getByRole('button', { name: 'Add row' }).click();
  await expect(page.locator('.preview-table-scroll tbody tr')).toHaveCount(2);
  await expect(bodyInput(page)).toHaveValue(/\|  \|  \|/);

  await page.getByRole('button', { name: 'Add column' }).click();
  await expect(page.locator('.preview-table-scroll thead th')).toHaveCount(3);
  await expect(bodyInput(page)).toHaveValue(/\| Column \| Value \| Column \|/);
});

test('edits preview metadata and headings', async ({ page }) => {
  await field(page, 'title').fill('Preview Draft');
  await field(page, 'description').fill('Original preview description');
  await field(page, 'tags').fill('alpha, beta');
  await bodyInput(page).fill([
    '## Original heading'
  ].join('\n'));

  await togglePreview(page);

  await replaceEditableText(page.locator('[data-preview-field="title"]'), 'Preview Edited Title');
  await expect(field(page, 'title')).toHaveValue('Preview Edited Title');
  await expect(field(page, 'slug')).toHaveValue('preview-edited-title');

  await replaceEditableText(page.locator('[data-preview-field="description"]'), 'Edited preview description');
  await expect(field(page, 'description')).toHaveValue('Edited preview description');

  await replaceEditableText(page.locator('[data-preview-tags] li').first(), 'gamma');
  await expect(field(page, 'tags')).toHaveValue('gamma, beta');

  await replaceEditableText(page.locator('.preview-body h2'), 'Edited heading');
  await expect(bodyInput(page)).toHaveValue(/## Edited heading/);
});

test('edits preview media side text', async ({ page }) => {
  await bodyInput(page).fill([
    ':::media-right',
    '',
    '![Hero](hero.png)',
    '',
    'Original side text',
    '',
    ':::'
  ].join('\n'));
  await togglePreview(page);

  await replaceEditableText(page.locator('[data-media-copy]'), 'Edited side text');
  await expect(bodyInput(page)).toHaveValue(/Edited side text/);
});

test('does not flatten inline markdown or media blocks on preview focus and blur', async ({ page }) => {
  const markdown = [
    'This keeps *italic* and **bold** text.',
    '',
    ':::media-right',
    '',
    '![group 49](group-49.png)',
    '',
    '## Built for replays',
    '',
    '*HELP-A-FRIEND! Trivia* keeps emphasis.',
    '',
    ':::'
  ].join('\n');

  await bodyInput(page).fill(markdown);
  await togglePreview(page);

  await page.locator('.preview-body p').first().click();
  await page.locator('[data-save-state]').click();
  await page.locator('[data-media-copy]').click();
  await page.locator('[data-save-state]').click();

  await expect(bodyInput(page)).toHaveValue(markdown);
});

test('adds preview paragraph breaks without removing inline formatting', async ({ page }) => {
  await bodyInput(page).fill('This keeps *italic* text.');
  await togglePreview(page);

  const paragraph = page.locator('.preview-body p').first();
  await placeEditableCursorAtEnd(paragraph);
  await paragraph.press('Enter');
  await page.keyboard.insertText('New paragraph.');
  await expect(paragraph).toContainText('New paragraph.');
  await page.locator('[data-save-state]').click();

  await expect(bodyInput(page)).toHaveValue('This keeps *italic* text.\n\nNew paragraph.');
  await refreshPreview(page);
  await expect(page.locator('.preview-body em')).toHaveText('italic');
  await expect(page.locator('.preview-body p')).toContainText([
    'This keeps italic text.',
    'New paragraph.'
  ]);
});

test('keeps media side text markdown stable while adding preview lines', async ({ page }) => {
  const markdown = [
    ':::media-right',
    '',
    '![group 49](group-49.png)',
    '',
    'The second Playground game is now available: *HELP-A-FRIEND! Trivia*.',
    '',
    '## Built for replays',
    '',
    '*HELP-A-FRIEND! Trivia* is designed for streams you want to revisit.',
    '',
    ':::'
  ].join('\n');

  await bodyInput(page).fill(markdown);
  await togglePreview(page);

  await page.locator('[data-media-copy]').click();
  await page.locator('[data-save-state]').click();
  await expect(bodyInput(page)).toHaveValue(markdown);

  const firstMediaParagraph = page.locator('[data-media-copy] p').first();
  await placeEditableCursorAtEnd(firstMediaParagraph);
  await firstMediaParagraph.press('Enter');
  await page.keyboard.type('Correct answers get the trophy reaction.');
  await page.locator('[data-save-state]').click();

  await expect(bodyInput(page)).toHaveValue([
    ':::media-right',
    '',
    '![group 49](group-49.png)',
    '',
    'The second Playground game is now available: *HELP-A-FRIEND! Trivia*.',
    '',
    'Correct answers get the trophy reaction.',
    '',
    '## Built for replays',
    '',
    '*HELP-A-FRIEND! Trivia* is designed for streams you want to revisit.',
    '',
    ':::'
  ].join('\n'));
});

test('edits preview ordered and task list items', async ({ page }) => {
  await bodyInput(page).fill([
    '1. First ordered item',
    '',
    '- [ ] First task'
  ].join('\n'));
  await togglePreview(page);

  await replaceEditableText(page.locator('.preview-body ol li'), 'Edited ordered item');
  await expect(bodyInput(page)).toHaveValue(/1\. Edited ordered item/);
  await refreshPreview(page);

  await replaceEditableText(page.locator('.preview-body .task-list-item'), 'Edited task');
  await expect(bodyInput(page)).toHaveValue(/- \[ \] Edited task/);
});

async function refreshPreview(page: Parameters<typeof bodyInput>[0]): Promise<void> {
  await page.locator('[data-preview-toggle]').click();
  await expect(bodyInput(page)).toBeVisible();
  await page.locator('[data-preview-toggle]').click();
  await expect(page.locator('[data-preview]')).toBeVisible();
}

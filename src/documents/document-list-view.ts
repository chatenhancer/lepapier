import type { DocumentRecord } from '../shared/types';

export interface DocumentListEditableState {
  connected: boolean;
}

export interface RenderDocumentListOptions {
  activeDocumentId: string;
  compact: boolean;
  documents: DocumentRecord[];
  getEditableState(documentId: string): DocumentListEditableState | undefined;
  root: HTMLElement;
  selectedDocumentIds?: Set<string>;
}

export function renderDocumentList({
  activeDocumentId,
  compact,
  documents,
  getEditableState,
  root,
  selectedDocumentIds = new Set()
}: RenderDocumentListOptions): void {
  root.replaceChildren();
  for (const documentRecord of documents) {
    const row = document.createElement('article');
    row.className = 'document-row';
    row.dataset.active = String(documentRecord.id === activeDocumentId);

    const select = document.createElement('input');
    select.type = 'checkbox';
    select.className = 'document-select';
    select.dataset.selectDocument = documentRecord.id;
    select.checked = selectedDocumentIds.has(documentRecord.id);
    select.setAttribute('aria-label', `Select ${getDocumentTitle(documentRecord)} for download`);

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'document-switch';
    button.dataset.switchDocument = documentRecord.id;

    const titleText = getDocumentTitle(documentRecord);
    const title = document.createElement('strong');
    title.className = 'document-title';
    title.setAttribute('aria-label', titleText);
    title.dataset.tooltip = titleText;

    const titleScroller = document.createElement('span');
    titleScroller.className = 'document-title-text';
    titleScroller.textContent = titleText;
    title.append(titleScroller);

    const meta = document.createElement('span');
    meta.className = 'document-meta';

    const updatedAt = document.createElement('time');
    updatedAt.dateTime = new Date(documentRecord.updatedAt || Date.now()).toISOString();
    updatedAt.textContent = formatDocumentEditTime(documentRecord.updatedAt);
    meta.append(updatedAt);

    const editableState = getEditableState(documentRecord.id);
    if (editableState?.connected) {
      const synced = document.createElement('span');
      synced.className = 'document-sync-badge';
      synced.textContent = 'Synced';
      synced.dataset.tooltip = getDocumentSyncTooltip(documentRecord);
      meta.append(synced);
    }

    button.append(title);
    if (!compact) {
      button.append(meta);
    }

    const reconnectButton = editableState && !editableState.connected
      ? createReconnectFolderButton(documentRecord.id)
      : null;

    const deleteButton = document.createElement('button');
    deleteButton.type = 'button';
    deleteButton.className = 'document-delete';
    deleteButton.dataset.deleteDocument = documentRecord.id;
    deleteButton.dataset.tooltip = 'Remove document';
    deleteButton.setAttribute('aria-label', `Remove ${titleText}`);
    deleteButton.innerHTML = [
      '<svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">',
      '<path d="M7 21a2 2 0 0 1-2-2V7H4V5h5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1h5v2h-1v12a2 2 0 0 1-2 2H7Zm10-14H7v12h10V7ZM11 9v8H9V9h2Zm4 0v8h-2V9h2ZM11 5h2V4h-2v1Z"></path>',
      '</svg>'
    ].join('');

    row.append(select);
    row.append(button);
    if (reconnectButton) row.append(reconnectButton);
    row.append(deleteButton);
    root.append(row);
    scheduleDocumentTitleMarquee(title, titleScroller);
  }
}

export function getDocumentTitle(documentRecord: DocumentRecord | null | undefined): string {
  return documentRecord?.fields?.title?.trim() || 'Untitled document';
}

export function getDocumentSyncTooltip(documentRecord: DocumentRecord | null | undefined): string {
  const markdownPath = documentRecord?.source?.markdownPath?.trim();
  if (!markdownPath) return 'Saves back to the opened source file.';
  if (documentRecord?.source?.mode === 'editable-folder') {
    return `Saves back to ${markdownPath} in the opened folder.`;
  }
  return `Saves back to ${markdownPath}.`;
}

export function formatDocumentCount(count: number): string {
  const safeCount = Math.max(0, Math.trunc(count));
  return `${safeCount} ${safeCount === 1 ? 'document' : 'documents'} open`;
}

export function formatDocumentEditTime(value: number, now = new Date()): string {
  const timestamp = Number(value);
  if (!Number.isFinite(timestamp)) return 'No edits yet';

  const date = new Date(timestamp);
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) {
    return `Edited ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
  }

  return `Edited ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}`;
}

function createReconnectFolderButton(documentId: string): HTMLButtonElement {
  const reconnectButton = document.createElement('button');
  reconnectButton.type = 'button';
  reconnectButton.className = 'document-sync-reconnect';
  reconnectButton.dataset.reconnectFolder = documentId;
  reconnectButton.dataset.tooltip = 'Reconnect the editable folder.';
  reconnectButton.textContent = 'Reconnect';
  return reconnectButton;
}

function scheduleDocumentTitleMarquee(title: HTMLElement, titleText: HTMLElement): void {
  const scheduleFrame = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : (callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    };
  scheduleFrame(() => {
    const overflowDistance = Math.ceil(titleText.scrollWidth - title.clientWidth);
    const hasOverflow = overflowDistance > 1;
    title.dataset.overflow = String(hasOverflow);
    if (!hasOverflow) {
      title.style.removeProperty('--document-title-marquee-distance');
      title.style.removeProperty('--document-title-marquee-duration');
      return;
    }

    const travelDistance = overflowDistance + 18;
    const duration = Math.min(8, Math.max(3.2, travelDistance / 32));
    title.style.setProperty('--document-title-marquee-distance', `${travelDistance}px`);
    title.style.setProperty('--document-title-marquee-duration', `${duration.toFixed(1)}s`);
  });
}

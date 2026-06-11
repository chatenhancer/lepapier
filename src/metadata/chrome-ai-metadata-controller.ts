import {
  type ChromeAiMetadataClient,
  createChromeAiMetadataClient,
  isChromeAiSupported
} from '../browser/chrome-ai';
import { hasUserWrittenDocumentBody } from '../app/workspace-state';
import type { DocumentFields } from '../shared/types';
import {
  capitalize,
  slugify,
  stripMarkdown
} from '../shared/text';

type MetadataFieldName = Extract<keyof DocumentFields, 'description' | 'tags' | 'title'>;
type WritableFieldName = Extract<keyof DocumentFields, 'description' | 'slug' | 'tags' | 'title'>;

export interface AiMetadataRegenerationState {
  bodyText: string;
  canRegenerate: boolean;
  hasMinimumBodyText: boolean;
  hasUserBody: boolean;
}

export interface ChromeAiMetadataController {
  schedule(delay?: number): void;
}

export interface ChromeAiMetadataControllerOptions {
  enableButton: HTMLButtonElement;
  getFieldValue(name: keyof DocumentFields): string;
  isSlugEdited(): boolean;
  markDescriptionEdited(): void;
  markTagsEdited(): void;
  markTitleEdited(): void;
  recordHistory(): void;
  regenerateButtons: HTMLButtonElement[];
  setFieldValue(name: WritableFieldName, value: string): void;
  status: HTMLElement;
  sync(): void;
}

export function setupChromeAiMetadataController({
  enableButton,
  getFieldValue,
  isSlugEdited,
  markDescriptionEdited,
  markTagsEdited,
  markTitleEdited,
  recordHistory,
  regenerateButtons,
  setFieldValue,
  status,
  sync
}: ChromeAiMetadataControllerOptions): ChromeAiMetadataController {
  let enabled = false;
  let busy = false;
  let client: ChromeAiMetadataClient | null = null;
  let clientUnavailable = !isChromeAiSupported();

  const setStatus = (text: string) => {
    status.textContent = text;
  };

  const updateControlStates = () => {
    const available = isChromeAiSupported() && !clientUnavailable;
    const regenerationState = getAiMetadataRegenerationState(getFieldValue('body'));

    enableButton.hidden = true;
    enableButton.disabled = true;
    for (const button of regenerateButtons) {
      const field = button.dataset.aiRegenerate || '';
      const fieldAvailable = isMetadataField(field);
      button.disabled = !fieldAvailable || !available || busy || !regenerationState.canRegenerate;
      button.hidden = !fieldAvailable;
      updateRegenerateButtonTooltip(button, {
        available,
        busy,
        field,
        regenerationState
      });
    }
  };

  const setMetadataButtonBusy = (button: HTMLButtonElement | null, nextBusy: boolean) => {
    if (!button) return;
    button.classList.toggle('is-busy', nextBusy);
    updateControlStates();
  };

  const schedule = (_delay = 1800) => {
    updateControlStates();
  };

  const ensureClient = async ({ manual }: { manual: boolean }): Promise<boolean> => {
    if (enabled) {
      updateControlStates();
      return true;
    }

    if (!isChromeAiSupported()) {
      clientUnavailable = true;
      updateControlStates();
      setStatus('Chrome built-in AI is not available in this browser.');
      return false;
    }

    try {
      setStatus(manual ? 'Checking Chrome AI...' : 'Starting Chrome AI...');
      const nextClient = await createChromeAiMetadataClient({
        onDownloadProgress(percent) {
          setStatus(`Downloading Chrome AI model ${percent}%...`);
        }
      });
      if (!nextClient) {
        clientUnavailable = true;
        updateControlStates();
        setStatus('Chrome built-in AI is unavailable here.');
        return false;
      }

      client = nextClient;
      enabled = true;
      clientUnavailable = false;
      updateControlStates();
      setStatus(nextClient.hasLanguageModel ? 'Chrome AI ready.' : 'Chrome AI ready for descriptions.');
      return true;
    } catch (error) {
      clientUnavailable = true;
      updateControlStates();
      setStatus(`Chrome AI could not start: ${getErrorMessage(error)}`);
      return false;
    }
  };

  const regenerateField = async (fieldName: string, button: HTMLButtonElement): Promise<void> => {
    if (!isMetadataField(fieldName)) return;
    if (busy) {
      setStatus('Chrome AI is already updating metadata.');
      return;
    }

    const markdownBody = getFieldValue('body');
    const regenerationState = getAiMetadataRegenerationState(markdownBody);
    if (!regenerationState.hasUserBody) {
      updateControlStates();
      setStatus('Write in the body before regenerating metadata.');
      return;
    }

    const bodyText = regenerationState.bodyText;
    if (!regenerationState.hasMinimumBodyText) {
      updateControlStates();
      setStatus('Write more text before regenerating metadata.');
      return;
    }

    setMetadataButtonBusy(button, true);
    busy = true;
    updateControlStates();
    try {
      const ready = await ensureClient({ manual: true });
      if (!ready || !client) return;

      setStatus(`Regenerating ${fieldName}...`);
      const source = createAiMetadataSource(getFieldValue('title'), bodyText);
      recordHistory();

      if (fieldName === 'title') {
        const title = await client.suggestTitle(source, markdownBody);
        if (title) {
          setFieldValue('title', title);
          markTitleEdited();
          if (!isSlugEdited()) {
            setFieldValue('slug', slugify(title));
          }
        }
      } else if (fieldName === 'description') {
        const summary = await client.summarizeDescription(bodyText, getFieldValue('title') || 'Untitled document');
        setFieldValue('description', summary);
        markDescriptionEdited();
      } else {
        const tags = await client.suggestTags(source);
        if (tags.length) {
          setFieldValue('tags', tags.join(', '));
          markTagsEdited();
        }
      }

      sync();
      setStatus(`${capitalize(fieldName)} regenerated.`);
    } catch (error) {
      setStatus(`Chrome AI ${fieldName} failed: ${getErrorMessage(error)}`);
    } finally {
      busy = false;
      setMetadataButtonBusy(button, false);
      updateControlStates();
    }
  };

  for (const button of regenerateButtons) {
    button.addEventListener('click', () => {
      void regenerateField(button.dataset.aiRegenerate || '', button);
    });
  }

  updateControlStates();
  setStatus(isChromeAiSupported()
    ? 'Write text, then use field refresh buttons for metadata.'
    : 'Chrome built-in AI is not available in this browser.');

  return {
    schedule
  };
}

export function createAiMetadataSource(title: string, bodyText: string): string {
  return `${title}\n${bodyText.slice(0, 5000)}`;
}

export function getAiMetadataRegenerationState(body: string): AiMetadataRegenerationState {
  const bodyText = stripMarkdown(body);
  const hasUserBody = hasUserWrittenDocumentBody(body);
  const hasMinimumBodyText = bodyText.length >= 80;
  return {
    bodyText,
    canRegenerate: hasUserBody && hasMinimumBodyText,
    hasMinimumBodyText,
    hasUserBody
  };
}

interface RegenerateButtonTooltipOptions {
  available: boolean;
  busy: boolean;
  field: string;
  regenerationState: AiMetadataRegenerationState;
}

function updateRegenerateButtonTooltip(
  button: HTMLButtonElement,
  {
    available,
    busy,
    field,
    regenerationState
  }: RegenerateButtonTooltipOptions
): void {
  const tooltip = getRegenerateButtonTooltip({
    available,
    busy,
    field,
    regenerationState
  });

  button.dataset.tooltip = tooltip;
  button.removeAttribute('title');
}

function getRegenerateButtonTooltip({
  available,
  busy,
  field,
  regenerationState
}: RegenerateButtonTooltipOptions): string {
  if (!isMetadataField(field)) return 'Metadata refresh is unavailable.';
  if (!available) return 'Chrome built-in AI is not available in this browser.';
  if (busy) return 'Wait for the current metadata refresh to finish.';
  if (!regenerationState.hasUserBody) return 'Write in the body before regenerating metadata.';
  if (!regenerationState.hasMinimumBodyText) return 'Write more text before regenerating metadata.';

  return `Regenerate ${field} with Chrome AI`;
}

function isMetadataField(fieldName: string): fieldName is MetadataFieldName {
  return fieldName === 'title' || fieldName === 'description' || fieldName === 'tags';
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown error';
}

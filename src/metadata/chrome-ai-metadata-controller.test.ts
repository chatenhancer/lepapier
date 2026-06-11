import {
  afterEach,
  describe,
  expect,
  it,
  vi
} from 'vitest';

import {
  createAiMetadataSource,
  getAiMetadataRegenerationState,
  setupChromeAiMetadataController
} from './chrome-ai-metadata-controller';

function createFakeButton(dataset: Record<string, string> = {}) {
  const clickListeners: Array<() => void> = [];
  const classes = new Set<string>();
  return {
    addEventListener(eventName: string, listener: () => void) {
      if (eventName === 'click') clickListeners.push(listener);
    },
    classList: {
      contains(className: string) {
        return classes.has(className);
      },
      toggle(className: string, force?: boolean) {
        const shouldAdd = force ?? !classes.has(className);
        if (shouldAdd) {
          classes.add(className);
        } else {
          classes.delete(className);
        }
        return shouldAdd;
      }
    },
    click() {
      for (const listener of clickListeners) {
        listener();
      }
    },
    dataset,
    disabled: false,
    hidden: false,
    removeAttribute() {},
    title: '',
    textContent: ''
  } as unknown as HTMLButtonElement & {
    classList: DOMTokenList & {
      contains(className: string): boolean;
    };
    click(): void;
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return {
    promise,
    resolve
  };
}

async function flushMicrotasks(count = 6): Promise<void> {
  for (let index = 0; index < count; index += 1) {
    await Promise.resolve();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Chrome AI metadata controller helpers', () => {
  it('builds a bounded source from title and body text', () => {
    const body = 'a'.repeat(5100);
    const source = createAiMetadataSource('Title', body);

    expect(source).toBe(`Title\n${'a'.repeat(5000)}`);
    expect(source).toHaveLength(5006);
  });

  it('requires user-written body text before metadata can regenerate', () => {
    expect(getAiMetadataRegenerationState('').canRegenerate).toBe(false);
    expect(getAiMetadataRegenerationState('Short note.').canRegenerate).toBe(false);
    expect(getAiMetadataRegenerationState('A real note. '.repeat(10)).canRegenerate).toBe(true);
  });

  it('disables metadata controls when regeneration is blocked', async () => {
    const description = createFakeButton({ aiRegenerate: 'description' });
    const tags = createFakeButton({ aiRegenerate: 'tags' });
    const title = createFakeButton({ aiRegenerate: 'title' });
    const enableButton = createFakeButton();
    const summary = createDeferred<string>();
    const createSummarizer = vi.fn(async () => ({
      summarize: () => summary.promise
    }));
    const createLanguageModel = vi.fn(async () => ({
      async prompt() {
        return 'suggested';
      }
    }));
    let body = '';

    vi.stubGlobal('Summarizer', {
      async availability() {
        return 'available';
      },
      create: createSummarizer
    });
    vi.stubGlobal('LanguageModel', {
      async availability() {
        return 'available';
      },
      create: createLanguageModel
    });

    const controller = setupChromeAiMetadataController({
      enableButton,
      getFieldValue(name) {
        return name === 'body' ? body : '';
      },
      isSlugEdited: () => false,
      markDescriptionEdited() {},
      markTagsEdited() {},
      markTitleEdited() {},
      recordHistory() {},
      regenerateButtons: [description, tags, title],
      setFieldValue() {},
      status: { textContent: '' } as HTMLElement,
      sync() {}
    });

    expect(enableButton.hidden).toBe(true);
    expect(enableButton.disabled).toBe(true);
    expect(description.hidden).toBe(false);
    expect(description.disabled).toBe(true);
    expect(description.dataset.tooltip).toBe('Write in the body before regenerating metadata.');
    expect(tags.disabled).toBe(true);
    expect(title.disabled).toBe(true);
    expect(createSummarizer).not.toHaveBeenCalled();

    body = 'A real note. '.repeat(10);
    controller.schedule(0);

    expect(enableButton.hidden).toBe(true);
    expect(enableButton.disabled).toBe(true);
    expect(description.disabled).toBe(false);
    expect(description.dataset.tooltip).toBe('Regenerate description with Chrome AI');
    expect(tags.disabled).toBe(false);
    expect(title.disabled).toBe(false);
    expect(createSummarizer).not.toHaveBeenCalled();

    description.click();
    await flushMicrotasks();

    expect(enableButton.disabled).toBe(true);
    expect(description.disabled).toBe(true);
    expect(tags.disabled).toBe(true);
    expect(title.disabled).toBe(true);
    expect(description.classList.contains('is-busy')).toBe(true);
    expect(description.dataset.tooltip).toBe('Wait for the current metadata refresh to finish.');
    expect(createSummarizer).toHaveBeenCalledTimes(1);
    expect(createLanguageModel).toHaveBeenCalledTimes(1);

    summary.resolve('summary');
    await flushMicrotasks();

    expect(enableButton.disabled).toBe(true);
    expect(description.disabled).toBe(false);
    expect(description.dataset.tooltip).toBe('Regenerate description with Chrome AI');
    expect(tags.disabled).toBe(false);
    expect(title.disabled).toBe(false);
    expect(description.classList.contains('is-busy')).toBe(false);
  });

  it('shows disabled metadata controls with an unsupported-browser tooltip', () => {
    const description = createFakeButton({ aiRegenerate: 'description' });

    setupChromeAiMetadataController({
      enableButton: createFakeButton(),
      getFieldValue() {
        return 'A real note. '.repeat(10);
      },
      isSlugEdited: () => false,
      markDescriptionEdited() {},
      markTagsEdited() {},
      markTitleEdited() {},
      recordHistory() {},
      regenerateButtons: [description],
      setFieldValue() {},
      status: { textContent: '' } as HTMLElement,
      sync() {}
    });

    expect(description.hidden).toBe(false);
    expect(description.disabled).toBe(true);
    expect(description.dataset.tooltip).toBe('Chrome built-in AI is not available in this browser.');
  });
});

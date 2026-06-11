import { appConfig } from '../app-config';
import {
  capitalize,
  cleanAiDescription,
  cleanAiTitle,
  parseTags,
  stripMarkdown
} from '../shared/text';

type ChromeAiAvailability = 'available' | 'downloadable' | 'downloading' | 'unavailable' | string;

interface SummarizerSession {
  summarize(value: string, options?: { context?: string }): Promise<string>;
}

interface SummarizerConstructor {
  availability(): Promise<ChromeAiAvailability>;
  create(options: {
    format: 'plain-text';
    length: 'short';
    monitor?: (monitor: EventTarget) => void;
    sharedContext: string;
    type: 'tldr';
  }): Promise<SummarizerSession>;
}

interface LanguageModelSession {
  prompt(messages: Array<{ content: string; role: 'system' | 'user' }>): Promise<string>;
}

interface LanguageModelConstructor {
  availability(options: LanguageModelOptions): Promise<ChromeAiAvailability>;
  create(options: LanguageModelOptions & {
    initialPrompts: Array<{ content: string; role: 'system' }>;
  }): Promise<LanguageModelSession>;
}

interface LanguageModelOptions {
  expectedInputs: Array<{ languages: string[]; type: 'text' }>;
  expectedOutputs: Array<{ languages: string[]; type: 'text' }>;
}

interface ChromeAiGlobal {
  LanguageModel?: LanguageModelConstructor;
  Summarizer?: SummarizerConstructor;
}

export interface ChromeAiMetadataClient {
  hasLanguageModel: boolean;
  summarizeDescription(bodyText: string, title: string): Promise<string>;
  suggestTags(source: string): Promise<string[]>;
  suggestTitle(source: string, markdownBody: string): Promise<string>;
}

export interface CreateChromeAiMetadataClientOptions {
  onDownloadProgress?: (percent: number) => void;
}

export function isChromeAiSupported(): boolean {
  return Boolean((globalThis as ChromeAiGlobal).Summarizer);
}

export async function createChromeAiMetadataClient(
  options: CreateChromeAiMetadataClientOptions = {}
): Promise<ChromeAiMetadataClient | null> {
  const aiGlobal = globalThis as ChromeAiGlobal;
  if (!aiGlobal.Summarizer) return null;

  const availability = await aiGlobal.Summarizer.availability();
  if (availability === 'unavailable') return null;

  const summarizer = await aiGlobal.Summarizer.create({
    format: 'plain-text',
    length: 'short',
    sharedContext: capitalize(appConfig.metadataContext),
    type: 'tldr',
    monitor(monitor) {
      monitor.addEventListener('downloadprogress', (event) => {
        const progressEvent = event as Event & { loaded?: number };
        options.onDownloadProgress?.(Math.round(Number(progressEvent.loaded || 0) * 100));
      });
    }
  });

  let languageSession = await createLanguageModelSession(aiGlobal);

  return {
    get hasLanguageModel() {
      return Boolean(languageSession);
    },
    async summarizeDescription(bodyText, title) {
      const summary = await summarizer.summarize(bodyText, {
        context: `Summarize this ${appConfig.metadataContext} in one clear sentence. Title: ${title || 'Untitled document'}`
      });
      return cleanAiDescription(summary);
    },
    async suggestTags(source) {
      if (languageSession) {
        try {
          const response = await languageSession.prompt([
            {
              content: [
                'Suggest 3 to 5 lowercase tags for this document.',
                'Return only comma-separated tags, no explanation.',
                source.slice(0, 4200)
              ].join('\n\n'),
              role: 'user'
            }
          ]);
          const tags = parseTags(response).slice(0, 5);
          if (tags.length) return tags;
        } catch {
          languageSession = null;
        }
      }

      return suggestLocalTags(source);
    },
    async suggestTitle(source, markdownBody) {
      if (languageSession) {
        try {
          const response = await languageSession.prompt([
            {
              content: [
                'Suggest one concise public document title.',
                'Return only the title, with no quotes, punctuation wrapper, or explanation.',
                'Keep it under 70 characters.',
                source.slice(0, 4200)
              ].join('\n\n'),
              role: 'user'
            }
          ]);
          const title = cleanAiTitle(response);
          if (title) return title;
        } catch {
          languageSession = null;
        }
      }

      return suggestLocalTitle(source, markdownBody);
    }
  };
}

function suggestLocalTags(source: string): string[] {
  const normalized = source.toLowerCase();
  const candidates: Array<[string, RegExp]> = [
    ['release', /\b(release|version|update|shipping|published)\b/],
    ['playground', /\b(playground|game|chess|lobby|invite)\b/],
    ['translation', /\b(translate|translation|language)\b/],
    ['inbox', /\b(inbox|mention|keyword|alert)\b/],
    ['popup', /\b(popup|settings|bookmark|status)\b/],
    ['docs', /\b(docs|website|walkthrough|blog)\b/]
  ];
  const tags = candidates
    .filter(([, pattern]) => pattern.test(normalized))
    .map(([tag]) => tag);
  return tags.length ? tags.slice(0, 5) : ['update'];
}

function suggestLocalTitle(source: string, markdownBody: string): string {
  const heading = /^#{1,3}\s+(.+)$/m.exec(markdownBody);
  if (heading) {
    return cleanAiTitle(heading[1]);
  }

  return cleanAiTitle(stripMarkdown(source).split(/[.!?]/)[0]);
}

async function createLanguageModelSession(aiGlobal: ChromeAiGlobal): Promise<LanguageModelSession | null> {
  if (!aiGlobal.LanguageModel) return null;

  try {
    const options: LanguageModelOptions = {
      expectedInputs: [{ type: 'text', languages: ['en'] }],
      expectedOutputs: [{ type: 'text', languages: ['en'] }]
    };
    const availability = await aiGlobal.LanguageModel.availability(options);
    if (availability === 'unavailable') return null;

    return await aiGlobal.LanguageModel.create({
      ...options,
      initialPrompts: [{
        content: 'You suggest concise blog metadata. Return only the requested values.',
        role: 'system'
      }]
    });
  } catch {
    return null;
  }
}

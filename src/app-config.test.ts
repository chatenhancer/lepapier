import { describe, expect, it } from 'vitest';

import packageJson from '../package.json' with { type: 'json' };
import { appConfig } from './app-config';

describe('appConfig', () => {
  it('uses standalone product assets and storage', () => {
    expect(appConfig.name).toBe('Lepapier');
    expect(appConfig.displayVersion).toBe(`lepapier.app v${packageJson.version}`);
    expect(appConfig.buildTimestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(appConfig.buildTooltip).toBe(`Build date: ${appConfig.buildTimestamp}`);
    expect(appConfig.homeHref).toBe('https://lepapier.app');
    expect(appConfig.iconSrc).toBe('/assets/icons/lepapier.svg');
    expect(appConfig.logoDarkSrc).toBe('/assets/icons/lepapier-dark.svg');
    expect(appConfig.releaseNotesHref).toBe('https://github.com/chatenhancer/lepapier/releases');
    expect(appConfig.storageNamespace).toBe('lepapier');
  });
});

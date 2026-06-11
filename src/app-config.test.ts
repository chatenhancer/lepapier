import { describe, expect, it } from 'vitest';

import { appConfig } from './app-config';

describe('appConfig', () => {
  it('uses standalone product assets and storage', () => {
    expect(appConfig.name).toBe('Lepapier');
    expect(appConfig.homeHref).toBe('/');
    expect(appConfig.iconSrc).toBe('/assets/icons/lepapier.svg');
    expect(appConfig.storageNamespace).toBe('lepapier');
  });
});

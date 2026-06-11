import { describe, expect, it } from 'vitest';

import { normalizeTheme } from './theme-controller';

describe('theme controller helpers', () => {
  it('normalizes unknown themes to light', () => {
    expect(normalizeTheme('dark')).toBe('dark');
    expect(normalizeTheme('light')).toBe('light');
    expect(normalizeTheme('system')).toBe('light');
  });
});

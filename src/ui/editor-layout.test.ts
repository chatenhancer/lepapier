import { describe, expect, it } from 'vitest';
import {
  clampPaperWidth,
  getSidebarAvoidance
} from './editor-layout';

describe('editor layout helpers', () => {
  it('clamps paper width to editor bounds', () => {
    const bounds = {
      defaultWidth: 800,
      maximumWidth: 920,
      minimumWidth: 540
    };

    expect(clampPaperWidth(1200, bounds)).toBe(920);
    expect(clampPaperWidth(320, bounds)).toBe(540);
    expect(clampPaperWidth('bad', bounds)).toBe(800);
  });

  it('calculates only positive sidebar avoidance', () => {
    expect(getSidebarAvoidance({ right: 850 }, { left: 830 })).toBe(44);
    expect(getSidebarAvoidance({ right: 600 }, { left: 830 })).toBe(0);
  });
});

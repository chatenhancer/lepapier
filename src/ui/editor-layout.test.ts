import { describe, expect, it } from 'vitest';
import {
  clampPaperWidth,
  getFixedRightSidebarLeft,
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

  it('calculates fixed sidebar position without transformed layout rects', () => {
    expect(getFixedRightSidebarLeft({
      fallbackLeft: 1200,
      right: '24px',
      viewportWidth: 1440,
      width: '250px'
    })).toBe(1166);
    expect(getFixedRightSidebarLeft({
      fallbackLeft: 820,
      right: 'auto',
      viewportWidth: 1440,
      width: '250px'
    })).toBe(820);
  });
});

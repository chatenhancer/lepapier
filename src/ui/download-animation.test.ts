import { describe, expect, it } from 'vitest';

import {
  getDownloadEnvelopeTop,
  playDownloadAnimation
} from './download-animation';

type AnimationEndListener = (event: { animationName: string }) => void;

function createFakeElement(top = 0) {
  const addCalls: string[] = [];
  const removeCalls: string[] = [];
  const styleProperties = new Map<string, string>();
  const listeners = new Map<string, AnimationEndListener[]>();
  let offsetReads = 0;

  const element = {
    addEventListener(eventName: string, listener: AnimationEndListener) {
      listeners.set(eventName, [...(listeners.get(eventName) ?? []), listener]);
    },
    classList: {
      add(className: string) {
        addCalls.push(className);
      },
      remove(className: string) {
        removeCalls.push(className);
      }
    },
    dispatchAnimationEnd(animationName: string) {
      for (const listener of listeners.get('animationend') ?? []) {
        listener({ animationName });
      }
    },
    getBoundingClientRect() {
      return { top };
    },
    get offsetWidth() {
      offsetReads += 1;
      return 100;
    },
    removeEventListener(eventName: string, listener: AnimationEndListener) {
      listeners.set(
        eventName,
        (listeners.get(eventName) ?? []).filter((activeListener) => activeListener !== listener)
      );
    },
    style: {
      setProperty(name: string, value: string) {
        styleProperties.set(name, value);
      }
    }
  };

  return {
    addCalls,
    element: element as unknown as HTMLElement,
    get offsetReads() {
      return offsetReads;
    },
    removeCalls,
    styleProperties,
    triggerAnimationEnd: element.dispatchAnimationEnd
  };
}

function createFakeWindow(): Window {
  return {
    clearTimeout() {},
    innerHeight: 1000,
    matchMedia() {
      return { matches: false };
    },
    setTimeout() {
      return 1;
    }
  } as unknown as Window;
}

describe('download animation helpers', () => {
  it('positions the envelope at the desktop viewport target when scrolled', () => {
    expect(getDownloadEnvelopeTop({
      columnTop: -1200,
      isCompactViewport: false,
      viewportHeight: 1000
    })).toBe(1520);
  });

  it('uses the compact viewport envelope target', () => {
    expect(getDownloadEnvelopeTop({
      columnTop: -800,
      isCompactViewport: true,
      viewportHeight: 700
    })).toBe(1050);
  });

  it('does not place the envelope above the writing column', () => {
    expect(getDownloadEnvelopeTop({
      columnTop: 300,
      isCompactViewport: false,
      viewportHeight: 700
    })).toBe(0);
  });

  it('does not restart an active animation', async () => {
    const paper = createFakeElement();
    const writingColumn = createFakeElement(-1200);
    const windowTarget = createFakeWindow();

    const firstAnimation = playDownloadAnimation({
      fallbackMs: 1700,
      paper: paper.element,
      windowTarget,
      writingColumn: writingColumn.element
    });
    const repeatedAnimation = playDownloadAnimation({
      fallbackMs: 1700,
      paper: paper.element,
      windowTarget,
      writingColumn: writingColumn.element
    });

    expect(repeatedAnimation).toBe(firstAnimation);
    expect(paper.addCalls.filter((className) => className === 'is-download-folding')).toHaveLength(1);
    expect(writingColumn.addCalls.filter((className) => className === 'is-mailing')).toHaveLength(1);
    expect(paper.offsetReads).toBe(1);

    paper.triggerAnimationEnd('paper-mail-fold');
    await firstAnimation;

    const nextAnimation = playDownloadAnimation({
      fallbackMs: 1700,
      paper: paper.element,
      windowTarget,
      writingColumn: writingColumn.element
    });

    expect(nextAnimation).not.toBe(firstAnimation);
    expect(paper.addCalls.filter((className) => className === 'is-download-folding')).toHaveLength(2);

    paper.triggerAnimationEnd('paper-mail-fold');
    await nextAnimation;
  });
});

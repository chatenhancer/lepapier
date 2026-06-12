import { describe, expect, it } from 'vitest';

import {
  getDownloadEnvelopeTop,
  playDownloadAnimation
} from './download-animation';

type AnimationEndListener = (event: { animationName: string }) => void;

interface FakeRect {
  bottom: number;
  height: number;
  left: number;
  right: number;
  top: number;
  width: number;
}

interface FakeElementHarness {
  addCalls: string[];
  element: HTMLElement;
  findChildByClass(className: string): HTMLElement | null;
  offsetReads: number;
  removeCalls: string[];
  styleProperties: Map<string, string>;
  triggerAnimationEnd(animationName: string): void;
}

function createFakeElement(
  rectInput: Partial<FakeRect> = {},
  ownerDocument?: Pick<Document, 'createElement'>
): FakeElementHarness {
  const addCalls: string[] = [];
  const removeCalls: string[] = [];
  const children: HTMLElement[] = [];
  const classNames = new Set<string>();
  const styleProperties = new Map<string, string>();
  const listeners = new Map<string, AnimationEndListener[]>();
  let offsetReads = 0;
  let parentChildren: HTMLElement[] | null = null;
  const rect = {
    top: 0,
    left: 0,
    width: 100,
    height: 100,
    ...rectInput
  };
  const fullRect: FakeRect = {
    ...rect,
    bottom: rectInput.bottom ?? rect.top + rect.height,
    right: rectInput.right ?? rect.left + rect.width
  };
  let documentRef: Pick<Document, 'createElement'>;

  const findChildByClass = (className: string) => {
    return children.find((child) => {
      return (child as unknown as { __classNames: Set<string> }).__classNames.has(className);
    }) ?? null;
  };

  const element = {
    addEventListener(eventName: string, listener: AnimationEndListener) {
      listeners.set(eventName, [...(listeners.get(eventName) ?? []), listener]);
    },
    appendChild(child: HTMLElement) {
      children.push(child);
      (child as unknown as { __setParentChildren(parent: HTMLElement[]): void }).__setParentChildren(children);
      return child;
    },
    get className() {
      return [...classNames].join(' ');
    },
    set className(value: string) {
      classNames.clear();
      for (const className of value.split(/\s+/)) {
        if (className) classNames.add(className);
      }
    },
    classList: {
      add(className: string) {
        addCalls.push(className);
        classNames.add(className);
      },
      remove(className: string) {
        removeCalls.push(className);
        classNames.delete(className);
      }
    },
    dispatchAnimationEnd(animationName: string) {
      for (const listener of listeners.get('animationend') ?? []) {
        listener({ animationName });
      }
    },
    findChildByClass,
    getBoundingClientRect() {
      return fullRect;
    },
    __classNames: classNames,
    __setParentChildren(parent: HTMLElement[]) {
      parentChildren = parent;
    },
    get offsetWidth() {
      offsetReads += 1;
      return 100;
    },
    ownerDocument: null as unknown as Pick<Document, 'createElement'>,
    querySelector(selector: string) {
      if (!selector.startsWith('.')) return null;
      return findChildByClass(selector.slice(1));
    },
    remove() {
      if (!parentChildren) return;
      const index = parentChildren.indexOf(element as unknown as HTMLElement);
      if (index >= 0) parentChildren.splice(index, 1);
      parentChildren = null;
    },
    removeEventListener(eventName: string, listener: AnimationEndListener) {
      listeners.set(
        eventName,
        (listeners.get(eventName) ?? []).filter((activeListener) => activeListener !== listener)
      );
    },
    setAttribute(name: string, value: string) {
      if (name === 'class') element.className = value;
    },
    style: {
      setProperty(name: string, value: string) {
        styleProperties.set(name, value);
      }
    }
  };
  const harness: FakeElementHarness = {
    addCalls,
    element: element as unknown as HTMLElement,
    findChildByClass,
    get offsetReads() {
      return offsetReads;
    },
    removeCalls,
    styleProperties,
    triggerAnimationEnd: element.dispatchAnimationEnd
  };

  documentRef = ownerDocument ?? {
    createElement() {
      return createFakeElement({}, documentRef).element;
    }
  };
  element.ownerDocument = documentRef;
  (element as unknown as { __fake: FakeElementHarness }).__fake = harness;

  return harness;
}

function getFakeHarness(element: HTMLElement): FakeElementHarness {
  return (element as unknown as { __fake: FakeElementHarness }).__fake;
}

function createFakeWindow({
  innerHeight = 1000,
  innerWidth = 1440,
  isCompact = false,
  reducedMotion = false
}: {
  innerHeight?: number;
  innerWidth?: number;
  isCompact?: boolean;
  reducedMotion?: boolean;
} = {}): Window {
  return {
    clearTimeout() {},
    innerHeight,
    innerWidth,
    matchMedia(query: string) {
      return {
        matches: query.includes('prefers-reduced-motion') ? reducedMotion : isCompact
      };
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
    const paper = createFakeElement({
      top: 100,
      left: 320,
      width: 800,
      height: 962
    });
    const writingColumn = createFakeElement({ top: -1200, left: 0 });
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
    const firstProxy = writingColumn.findChildByClass('download-paper-proxy');
    expect(firstProxy).toBeTruthy();
    expect(getFakeHarness(firstProxy as HTMLElement).offsetReads).toBe(1);

    getFakeHarness(firstProxy as HTMLElement).triggerAnimationEnd('download-paper-into-envelope');
    await firstAnimation;
    expect(writingColumn.findChildByClass('download-paper-proxy')).toBeNull();

    const nextAnimation = playDownloadAnimation({
      fallbackMs: 1700,
      paper: paper.element,
      windowTarget,
      writingColumn: writingColumn.element
    });

    expect(nextAnimation).not.toBe(firstAnimation);
    expect(paper.addCalls.filter((className) => className === 'is-download-folding')).toHaveLength(2);

    const nextProxy = writingColumn.findChildByClass('download-paper-proxy');
    expect(nextProxy).toBeTruthy();
    getFakeHarness(nextProxy as HTMLElement).triggerAnimationEnd('download-paper-into-envelope');
    await nextAnimation;
  });

  it('caps the animated paper proxy height for long documents', async () => {
    const paper = createFakeElement({
      top: -1800,
      left: 280,
      width: 720,
      height: 4200
    });
    const writingColumn = createFakeElement({ top: -1900, left: 0 });
    const envelope = createFakeElement({
      top: 320,
      left: 420,
      width: 360,
      height: 214
    });
    envelope.element.classList.add('download-envelope');
    writingColumn.element.appendChild(envelope.element);

    const animation = playDownloadAnimation({
      fallbackMs: 1700,
      paper: paper.element,
      windowTarget: createFakeWindow(),
      writingColumn: writingColumn.element
    });
    const proxy = writingColumn.findChildByClass('download-paper-proxy');
    expect(proxy).toBeTruthy();
    const proxyStyles = getFakeHarness(proxy as HTMLElement).styleProperties;

    expect(proxyStyles.get('--download-paper-width')).toBe('720px');
    expect(Number.parseFloat(proxyStyles.get('--download-paper-height') ?? '0')).toBeLessThan(700);

    getFakeHarness(proxy as HTMLElement).triggerAnimationEnd('download-paper-into-envelope');
    await animation;
  });
});

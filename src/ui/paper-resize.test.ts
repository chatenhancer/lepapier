import { describe, expect, it } from 'vitest';

import { setupPaperResizeController } from './paper-resize';

describe('paper resize controller', () => {
  it('reveals resize handles along the full sheet edges', () => {
    const paper = createFakeElement();
    const controller = setupPaperResizeController({
      body: createFakeElement().element,
      defaultWidth: 800,
      getWidth: () => 800,
      handles: [],
      onCommit() {},
      onRecordHistory() {},
      paper: paper.element,
      setWidth() {}
    });
    const sheetRect = {
      bottom: 900,
      left: 300,
      right: 1100,
      top: 100
    } as DOMRect;

    controller.updateVisibility(createPointerEvent({ clientX: 294, clientY: 120 }), sheetRect);
    expect(paper.classNames.has('is-resize-left-visible')).toBe(true);

    controller.updateVisibility(createPointerEvent({ clientX: 1106, clientY: 880 }), sheetRect);
    expect(paper.classNames.has('is-resize-right-visible')).toBe(true);

    controller.updateVisibility(createPointerEvent({ clientX: 294, clientY: 99 }), sheetRect);
    expect(paper.classNames.has('is-resize-left-visible')).toBe(false);
  });
});

function createPointerEvent({
  clientX,
  clientY
}: {
  clientX: number;
  clientY: number;
}): PointerEvent {
  return { clientX, clientY } as PointerEvent;
}

function createFakeElement() {
  const classNames = new Set<string>();
  const element = {
    classList: {
      add(className: string) {
        classNames.add(className);
      },
      contains(className: string) {
        return classNames.has(className);
      },
      remove(...classes: string[]) {
        for (const className of classes) {
          classNames.delete(className);
        }
      },
      toggle(className: string, force?: boolean) {
        const shouldAdd = force ?? !classNames.has(className);
        if (shouldAdd) {
          classNames.add(className);
        } else {
          classNames.delete(className);
        }
        return shouldAdd;
      }
    }
  } as HTMLElement;

  return {
    classNames,
    element
  };
}

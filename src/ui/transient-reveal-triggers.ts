import type { TransientRevealController } from './transient-reveal';

export interface TransientRevealTrigger {
  controller: TransientRevealController;
  element: HTMLElement;
}

export function bindTransientRevealTriggers(triggers: TransientRevealTrigger[]): void {
  for (const { controller, element } of triggers) {
    element.addEventListener('pointerenter', () => {
      controller.reveal();
    });
    element.addEventListener('pointerleave', () => {
      controller.scheduleFade();
    });
    element.addEventListener('focusin', () => {
      controller.reveal();
    });
    element.addEventListener('focusout', () => {
      controller.scheduleFade();
    });
  }
}

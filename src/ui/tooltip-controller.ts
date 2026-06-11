export interface TooltipControllerOptions {
  cursorOffset?: number;
  documentTarget?: Document;
  layer: HTMLElement;
  revealDelayMs?: number;
  viewportMargin?: number;
  windowTarget?: Window;
}

export function setupTooltipController({
  cursorOffset = 12,
  documentTarget = document,
  layer,
  revealDelayMs = 260,
  viewportMargin = 8,
  windowTarget = window
}: TooltipControllerOptions): void {
  let revealTimer = 0;
  let target: HTMLElement | null = null;
  let tooltipX = 0;
  let tooltipY = 0;

  const hideTooltip = () => {
    windowTarget.clearTimeout(revealTimer);
    target = null;
    layer.hidden = true;
  };

  const showTooltip = (tooltipTarget: HTMLElement, clientX: number, clientY: number) => {
    const text = tooltipTarget.dataset.tooltip?.trim();
    if (!text) {
      hideTooltip();
      return;
    }

    layer.textContent = text;
    layer.hidden = false;

    const rect = layer.getBoundingClientRect();
    let left = clientX + cursorOffset;
    let top = clientY + cursorOffset;

    if (left + rect.width + viewportMargin > windowTarget.innerWidth) {
      left = clientX - rect.width - cursorOffset;
    }
    if (top + rect.height + viewportMargin > windowTarget.innerHeight) {
      top = clientY - rect.height - cursorOffset;
    }

    layer.style.left = `${Math.max(viewportMargin, left)}px`;
    layer.style.top = `${Math.max(viewportMargin, top)}px`;
  };

  const scheduleTooltip = (tooltipTarget: HTMLElement, clientX: number, clientY: number) => {
    target = tooltipTarget;
    tooltipX = clientX;
    tooltipY = clientY;
    layer.hidden = true;
    windowTarget.clearTimeout(revealTimer);
    revealTimer = windowTarget.setTimeout(() => {
      if (target === tooltipTarget) {
        showTooltip(tooltipTarget, tooltipX, tooltipY);
      }
    }, revealDelayMs);
  };

  documentTarget.addEventListener('pointerover', (event) => {
    const tooltipTarget = getTooltipTargetForPointerEvent(event);
    if (!tooltipTarget) return;
    if (tooltipTarget === target) return;
    scheduleTooltip(tooltipTarget, event.clientX, event.clientY);
  });

  documentTarget.addEventListener('pointermove', (event) => {
    const tooltipTarget = getTooltipTargetForPointerEvent(event);
    if (tooltipTarget && tooltipTarget !== target) {
      scheduleTooltip(tooltipTarget, event.clientX, event.clientY);
      return;
    }
    if (!tooltipTarget && target) {
      hideTooltip();
      return;
    }
    if (!target) return;
    tooltipX = event.clientX;
    tooltipY = event.clientY;
    if (!layer.hidden) {
      showTooltip(target, tooltipX, tooltipY);
    }
  });

  documentTarget.addEventListener('pointerout', (event) => {
    if (!target) return;
    const source = getTooltipTarget(event.target);
    if (source !== target) return;
    const related = getElement(event.relatedTarget);
    if (related && target.contains(related)) return;
    hideTooltip();
  });

  documentTarget.addEventListener('focusin', (event) => {
    const tooltipTarget = getTooltipTarget(event.target);
    if (!tooltipTarget) return;
    target = tooltipTarget;
    windowTarget.clearTimeout(revealTimer);
    const rect = tooltipTarget.getBoundingClientRect();
    showTooltip(tooltipTarget, rect.left + rect.width / 2, rect.bottom + 6);
  });

  documentTarget.addEventListener('focusout', (event) => {
    if (getTooltipTarget(event.target) === target) {
      hideTooltip();
    }
  });

  windowTarget.addEventListener('scroll', hideTooltip, { passive: true });
  windowTarget.addEventListener('blur', hideTooltip);
}

function getTooltipTargetForPointerEvent(event: PointerEvent): HTMLElement | null {
  return getTooltipTarget(event.target)
    || event.view?.document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-tooltip]')
    || null;
}

function getTooltipTarget(target: EventTarget | Node | null): HTMLElement | null {
  const element = getElement(target);
  return element?.closest<HTMLElement>('[data-tooltip]') || null;
}

function getElement(node: EventTarget | Node | null): HTMLElement | null {
  if (node instanceof HTMLElement) return node;
  if (node instanceof Node) return node.parentElement;
  return null;
}

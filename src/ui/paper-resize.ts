export interface PaperResizeController {
  clearVisibility(): void;
  updateVisibility(event: PointerEvent, sheetRect: DOMRect): void;
}

export interface PaperResizeOptions {
  body?: HTMLElement;
  defaultWidth: number;
  getWidth(): number;
  handles: HTMLElement[];
  onCommit(): void;
  onRecordHistory(): void;
  paper: HTMLElement;
  revealDistance?: number;
  setWidth(width: number): void;
  verticalSlack?: number;
}

export function setupPaperResizeController({
  body = document.body,
  defaultWidth,
  getWidth,
  handles,
  onCommit,
  onRecordHistory,
  paper,
  revealDistance = 42,
  setWidth,
  verticalSlack = 0
}: PaperResizeOptions): PaperResizeController {
  const updateVisibility = (event: PointerEvent, sheetRect: DOMRect) => {
    if (body.classList.contains('is-resizing-sheet')) return;

    const nearHandleY = event.clientY >= sheetRect.top - verticalSlack
      && event.clientY <= sheetRect.bottom + verticalSlack;
    const nearLeftHandle = nearHandleY
      && event.clientX >= sheetRect.left - revealDistance
      && event.clientX <= sheetRect.left + revealDistance;
    const nearRightHandle = nearHandleY
      && event.clientX >= sheetRect.right - revealDistance
      && event.clientX <= sheetRect.right + revealDistance;

    paper.classList.toggle('is-resize-left-visible', nearLeftHandle);
    paper.classList.toggle('is-resize-right-visible', nearRightHandle);
  };

  const clearVisibility = () => {
    paper.classList.remove('is-resize-left-visible', 'is-resize-right-visible');
  };

  for (const handle of handles) {
    handle.addEventListener('dblclick', () => {
      onRecordHistory();
      setWidth(defaultWidth);
      onCommit();
    });

    handle.addEventListener('pointerdown', (event: PointerEvent) => {
      event.preventDefault();
      onRecordHistory();
      handle.setPointerCapture(event.pointerId);
      body.classList.add('is-resizing-sheet');

      const side = handle.dataset.paperResize === 'right' ? 'right' : 'left';
      const startX = event.clientX;
      const startWidth = getWidth();

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const delta = moveEvent.clientX - startX;
        setWidth(side === 'right' ? startWidth + delta : startWidth - delta);
      };

      const handlePointerUp = (upEvent: PointerEvent) => {
        body.classList.remove('is-resizing-sheet');
        updateVisibility(upEvent, paper.getBoundingClientRect());
        onCommit();
        handle.removeEventListener('pointermove', handlePointerMove);
        handle.removeEventListener('pointerup', handlePointerUp);
        handle.removeEventListener('pointercancel', handlePointerUp);
      };

      handle.addEventListener('pointermove', handlePointerMove);
      handle.addEventListener('pointerup', handlePointerUp);
      handle.addEventListener('pointercancel', handlePointerUp);
    });
  }

  return {
    clearVisibility,
    updateVisibility
  };
}

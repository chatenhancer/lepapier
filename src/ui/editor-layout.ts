import type { TransientRevealController } from './transient-reveal';

export interface EditorLayoutController {
  getPaperWidth(): number;
  handleSheetEdgePointerMove(event: PointerEvent, sheetRect?: DOMRect): void;
  resizeBodyInput(): void;
  scheduleSidebarAvoidanceUpdate(): void;
  setPaperWidth(value: unknown): void;
  updateToolbarScrollState(): void;
}

export interface EditorLayoutOptions {
  bodyInput: HTMLTextAreaElement;
  defaultPaperWidth: number;
  documentElement?: HTMLElement;
  documentsSidebarReveal: TransientRevealController;
  isPreviewActive(): boolean;
  maximumPaperWidth: number;
  minimumPaperWidth: number;
  paper: HTMLElement;
  sidebar: HTMLElement;
  sidebarReveal: TransientRevealController;
  windowTarget?: Window;
}

export function setupEditorLayoutController({
  bodyInput,
  defaultPaperWidth,
  documentElement = document.documentElement,
  documentsSidebarReveal,
  isPreviewActive,
  maximumPaperWidth,
  minimumPaperWidth,
  paper,
  sidebar,
  sidebarReveal,
  windowTarget = window
}: EditorLayoutOptions): EditorLayoutController {
  let paperWidth = defaultPaperWidth;
  let sidebarAvoidanceFrame = 0;

  const setSidebarAvoidance = (value: number) => {
    documentElement.style.setProperty('--sidebar-avoidance', `${Math.max(0, value)}px`);
  };

  const updateSidebarAvoidance = () => {
    if (windowTarget.matchMedia('(max-width: 1120px)').matches) {
      setSidebarAvoidance(0);
      return;
    }

    const sidebarStyle = windowTarget.getComputedStyle(sidebar);
    const sidebarLeft = getFixedRightSidebarLeft({
      fallbackLeft: sidebar.getBoundingClientRect().left,
      right: sidebarStyle.right,
      viewportWidth: windowTarget.innerWidth,
      width: sidebarStyle.width
    });
    setSidebarAvoidance(getSidebarAvoidance(paper.getBoundingClientRect(), { left: sidebarLeft }));
  };

  const scheduleSidebarAvoidanceUpdate = () => {
    windowTarget.cancelAnimationFrame(sidebarAvoidanceFrame);
    sidebarAvoidanceFrame = windowTarget.requestAnimationFrame(updateSidebarAvoidance);
  };

  const resizeBodyInput = () => {
    if (isPreviewActive() || bodyInput.hidden) return;

    bodyInput.style.height = 'auto';
    bodyInput.style.height = `${bodyInput.scrollHeight}px`;
  };

  const setPaperWidth = (value: unknown) => {
    paperWidth = clampPaperWidth(value, {
      defaultWidth: defaultPaperWidth,
      maximumWidth: maximumPaperWidth,
      minimumWidth: minimumPaperWidth
    });
    documentElement.style.setProperty('--paper-width', `${paperWidth}px`);
    scheduleSidebarAvoidanceUpdate();
    resizeBodyInput();
  };

  const handleSheetEdgePointerMove = (event: PointerEvent, sheetRect = paper.getBoundingClientRect()) => {
    const revealDistance = getSidebarRevealDistance(documentElement, windowTarget);
    const verticalSlack = 80;
    if (event.clientY < sheetRect.top - verticalSlack || event.clientY > sheetRect.bottom + verticalSlack) {
      return;
    }

    if (event.clientX < sheetRect.left && event.clientX >= sheetRect.left - revealDistance) {
      documentsSidebarReveal.revealTemporarily();
    } else if (event.clientX > sheetRect.right && event.clientX <= sheetRect.right + revealDistance) {
      sidebarReveal.revealTemporarily();
    }
  };

  const updateToolbarScrollState = () => {
    document.body.classList.toggle('is-editor-at-top', windowTarget.scrollY < 8);
  };

  return {
    getPaperWidth: () => paperWidth,
    handleSheetEdgePointerMove,
    resizeBodyInput,
    scheduleSidebarAvoidanceUpdate,
    setPaperWidth,
    updateToolbarScrollState
  };
}

export function clampPaperWidth(
  value: unknown,
  {
    defaultWidth,
    maximumWidth,
    minimumWidth
  }: { defaultWidth: number; maximumWidth: number; minimumWidth: number }
): number {
  return Math.min(maximumWidth, Math.max(minimumWidth, Number.isFinite(Number(value)) ? Number(value) : defaultWidth));
}

export function getSidebarAvoidance(
  paperRect: Pick<DOMRectReadOnly, 'right'>,
  sidebarRect: Pick<DOMRectReadOnly, 'left'>,
  gap = 24
): number {
  return Math.max(0, Math.ceil(paperRect.right + gap - sidebarRect.left));
}

export function getFixedRightSidebarLeft({
  fallbackLeft,
  right,
  viewportWidth,
  width
}: {
  fallbackLeft: number;
  right: string;
  viewportWidth: number;
  width: string;
}): number {
  const rightPixels = parseCssPixelValue(right);
  const widthPixels = parseCssPixelValue(width);
  if (!Number.isFinite(rightPixels) || !Number.isFinite(widthPixels)) return fallbackLeft;
  return viewportWidth - rightPixels - widthPixels;
}

function getSidebarRevealDistance(documentElement: HTMLElement, windowTarget: Window): number {
  return Number.parseFloat(windowTarget.getComputedStyle(documentElement).getPropertyValue('--sidebar-width')) + 110;
}

function parseCssPixelValue(value: string): number {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

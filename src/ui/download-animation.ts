export interface DownloadAnimationOptions {
  fallbackMs: number;
  paper: HTMLElement;
  windowTarget?: Window;
  writingColumn: HTMLElement;
}

interface DownloadEnvelopeTopOptions {
  columnTop: number;
  isCompactViewport: boolean;
  viewportHeight: number;
}

interface DownloadPaperProxyGeometry {
  height: number;
  left: number;
  insertY: number;
  stageHeight: number;
  stageWidth: number;
  stageX: number;
  stageY: number;
  targetHeight: number;
  targetX: number;
  targetY: number;
  targetWidth: number;
  top: number;
  width: number;
}

interface DownloadAnimationTargets {
  paper: HTMLElement;
  windowTarget: Window;
  writingColumn: HTMLElement;
}

interface EnvelopeInsertTarget {
  height: number;
  width: number;
  x: number;
  y: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const activeDownloadAnimations = new WeakMap<HTMLElement, Promise<void>>();
const downloadPaperProxyAnimationName = 'download-paper-into-envelope';
const envelopeViewBoxWidth = 480;
const envelopeViewBoxHeight = 286;
const envelopeSheetY = 34;
const envelopeSheetWidth = 452;
const envelopeSheetHeight = 228;
const envelopeStageOffsetRatio = 0.42;
const envelopeInsertOffsetRatio = 0.09;

export function getDownloadEnvelopeTop({
  columnTop,
  isCompactViewport,
  viewportHeight
}: DownloadEnvelopeTopOptions): number {
  const targetViewportTop = isCompactViewport
    ? 250
    : clamp(viewportHeight * 0.32, 220, 350);

  return Math.max(0, targetViewportTop - columnTop);
}

function positionDownloadEnvelope(writingColumn: HTMLElement, windowTarget: Window): void {
  const top = getDownloadEnvelopeTop({
    columnTop: writingColumn.getBoundingClientRect().top,
    isCompactViewport: windowTarget.matchMedia('(max-width: 760px)').matches,
    viewportHeight: windowTarget.innerHeight
  });

  writingColumn.style.setProperty('--download-envelope-top', `${top}px`);
}

function getEnvelopeInsertTarget(writingColumn: HTMLElement, windowTarget: Window): EnvelopeInsertTarget {
  const envelope = writingColumn.querySelector<HTMLElement>('.download-envelope');
  if (!envelope) {
    return {
      height: clamp(windowTarget.innerHeight * 0.12, 76, 126),
      width: clamp(windowTarget.innerWidth * 0.22, 210, 330),
      x: windowTarget.innerWidth / 2,
      y: clamp(windowTarget.innerHeight * 0.45, 240, 420)
    };
  }

  const envelopeRect = envelope.getBoundingClientRect();
  return {
    height: envelopeRect.height * (envelopeSheetHeight / envelopeViewBoxHeight),
    width: envelopeRect.width * (envelopeSheetWidth / envelopeViewBoxWidth),
    x: envelopeRect.left + envelopeRect.width / 2,
    y: envelopeRect.top + envelopeRect.height * ((envelopeSheetY + envelopeSheetHeight / 2) / envelopeViewBoxHeight)
  };
}

function getDownloadPaperProxyGeometry({
  paper,
  windowTarget,
  writingColumn
}: DownloadAnimationTargets): DownloadPaperProxyGeometry {
  const isCompactViewport = windowTarget.matchMedia('(max-width: 760px)').matches;
  const paperRect = paper.getBoundingClientRect();
  const columnRect = writingColumn.getBoundingClientRect();
  const preferredHeight = clamp(
    windowTarget.innerHeight * (isCompactViewport ? 0.56 : 0.62),
    isCompactViewport ? 340 : 440,
    isCompactViewport ? 520 : 660
  );
  const height = Math.max(1, Math.min(paperRect.height, preferredHeight));
  const width = Math.max(1, paperRect.width);
  const viewportTopInset = isCompactViewport ? 68 : 92;
  const viewportBottomInset = isCompactViewport ? 22 : 42;
  const viewportMaxTop = Math.max(
    viewportTopInset,
    windowTarget.innerHeight - height - viewportBottomInset
  );
  const preferredViewportTop = clamp(paperRect.top, viewportTopInset, viewportMaxTop);
  const paperMaxTop = Math.max(paperRect.top, paperRect.bottom - height);
  const sourceViewportTop = clamp(preferredViewportTop, paperRect.top, paperMaxTop);
  const sourceViewportLeft = paperRect.left;
  const sourceCenterX = sourceViewportLeft + width / 2;
  const sourceCenterY = sourceViewportTop + height / 2;
  const target = getEnvelopeInsertTarget(writingColumn, windowTarget);
  const targetFrameTop = target.y - target.height / 2;
  const stageFrameTop = targetFrameTop - target.height * envelopeStageOffsetRatio;
  const stageCenterY = stageFrameTop + target.height / 2;

  const getTargetSizedFrame = (centerX: number, centerY: number) => {
    return {
      height: target.height,
      width: target.width,
      x: centerX - sourceCenterX + (width - target.width) / 2,
      y: centerY - sourceCenterY + (height - target.height) / 2
    };
  };
  const stageFrame = getTargetSizedFrame(target.x, stageCenterY);
  const targetFrame = getTargetSizedFrame(target.x, target.y);
  const insertY = targetFrame.y + target.height * envelopeInsertOffsetRatio;

  return {
    height,
    insertY,
    left: sourceViewportLeft - columnRect.left,
    stageHeight: stageFrame.height,
    stageWidth: stageFrame.width,
    stageX: stageFrame.x,
    stageY: stageFrame.y,
    targetHeight: targetFrame.height,
    targetWidth: targetFrame.width,
    targetX: targetFrame.x,
    targetY: targetFrame.y,
    top: sourceViewportTop - columnRect.top,
    width
  };
}

function createDownloadPaperProxy({
  paper,
  windowTarget,
  writingColumn
}: DownloadAnimationTargets): HTMLElement {
  const existingProxy = writingColumn.querySelector('.download-paper-proxy');
  existingProxy?.remove();

  const proxy = paper.ownerDocument.createElement('div');
  const geometry = getDownloadPaperProxyGeometry({ paper, windowTarget, writingColumn });
  proxy.className = 'download-paper-proxy';
  proxy.setAttribute('aria-hidden', 'true');
  proxy.style.setProperty('--download-paper-left', `${geometry.left}px`);
  proxy.style.setProperty('--download-paper-top', `${geometry.top}px`);
  proxy.style.setProperty('--download-paper-width', `${geometry.width}px`);
  proxy.style.setProperty('--download-paper-height', `${geometry.height}px`);
  proxy.style.setProperty('--download-paper-stage-width', `${geometry.stageWidth}px`);
  proxy.style.setProperty('--download-paper-stage-height', `${geometry.stageHeight}px`);
  proxy.style.setProperty('--download-paper-stage-x', `${geometry.stageX}px`);
  proxy.style.setProperty('--download-paper-stage-y', `${geometry.stageY}px`);
  proxy.style.setProperty('--download-paper-target-width', `${geometry.targetWidth}px`);
  proxy.style.setProperty('--download-paper-target-height', `${geometry.targetHeight}px`);
  proxy.style.setProperty('--download-paper-target-x', `${geometry.targetX}px`);
  proxy.style.setProperty('--download-paper-target-y', `${geometry.targetY}px`);
  proxy.style.setProperty('--download-paper-insert-y', `${geometry.insertY}px`);
  writingColumn.appendChild(proxy);

  return proxy;
}

export function playDownloadAnimation({
  fallbackMs,
  paper,
  windowTarget = window,
  writingColumn
}: DownloadAnimationOptions): Promise<void> {
  if (windowTarget.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return Promise.resolve();
  }

  const activeAnimation = activeDownloadAnimations.get(writingColumn);
  if (activeAnimation) return activeAnimation;

  paper.classList.remove('is-download-folding');
  writingColumn.classList.remove('is-mailing');
  positionDownloadEnvelope(writingColumn, windowTarget);
  const proxy = createDownloadPaperProxy({ paper, windowTarget, writingColumn });
  void proxy.offsetWidth;
  writingColumn.classList.add('is-mailing');
  paper.classList.add('is-download-folding');
  proxy.classList.add('is-active');

  const animation = new Promise<void>((resolve) => {
    let finished = false;
    let fallbackTimeout = 0;
    const finish = () => {
      if (finished) return;
      finished = true;
      windowTarget.clearTimeout(fallbackTimeout);
      proxy.removeEventListener('animationend', handleAnimationEnd);
      paper.classList.remove('is-download-folding');
      writingColumn.classList.remove('is-mailing');
      proxy.remove();
      activeDownloadAnimations.delete(writingColumn);
      resolve();
    };
    const handleAnimationEnd = (event: AnimationEvent) => {
      if (event.animationName !== downloadPaperProxyAnimationName) return;
      finish();
    };
    fallbackTimeout = windowTarget.setTimeout(finish, fallbackMs);
    proxy.addEventListener('animationend', handleAnimationEnd);
  });

  activeDownloadAnimations.set(writingColumn, animation);
  return animation;
}

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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const activeDownloadAnimations = new WeakMap<HTMLElement, Promise<void>>();

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
  void paper.offsetWidth;
  writingColumn.classList.add('is-mailing');
  paper.classList.add('is-download-folding');

  const animation = new Promise<void>((resolve) => {
    let finished = false;
    let fallbackTimeout = 0;
    const finish = () => {
      if (finished) return;
      finished = true;
      windowTarget.clearTimeout(fallbackTimeout);
      paper.removeEventListener('animationend', handleAnimationEnd);
      paper.classList.remove('is-download-folding');
      writingColumn.classList.remove('is-mailing');
      activeDownloadAnimations.delete(writingColumn);
      resolve();
    };
    const handleAnimationEnd = (event: AnimationEvent) => {
      if (event.animationName !== 'paper-mail-fold') return;
      finish();
    };
    fallbackTimeout = windowTarget.setTimeout(finish, fallbackMs);
    paper.addEventListener('animationend', handleAnimationEnd);
  });

  activeDownloadAnimations.set(writingColumn, animation);
  return animation;
}

export interface TransientRevealController {
  reveal(): void;
  revealTemporarily(delay?: number): void;
  scheduleFade(delay?: number): void;
}

export interface TransientRevealOptions {
  asleepClassName?: string | null;
  awakeClassName?: string;
  defaultDelay?: number;
  elements: HTMLElement[];
  shouldStayRevealed?(): boolean;
  windowTarget?: Window;
}

export function createTransientReveal({
  asleepClassName = 'is-asleep',
  awakeClassName = 'is-awake',
  defaultDelay = 2800,
  elements,
  shouldStayRevealed = () => elements.some((element) => element.matches(':hover, :focus-within')),
  windowTarget = window
}: TransientRevealOptions): TransientRevealController {
  let revealTimeout = 0;

  const reveal = () => {
    windowTarget.clearTimeout(revealTimeout);
    for (const element of elements) {
      if (asleepClassName) {
        element.classList.remove(asleepClassName);
      }
      element.classList.add(awakeClassName);
    }
  };

  const scheduleFade = (delay = defaultDelay) => {
    windowTarget.clearTimeout(revealTimeout);
    revealTimeout = windowTarget.setTimeout(() => {
      if (shouldStayRevealed()) return;
      for (const element of elements) {
        element.classList.remove(awakeClassName);
        if (asleepClassName) {
          element.classList.add(asleepClassName);
        }
      }
    }, delay);
  };

  const revealTemporarily = (delay = defaultDelay) => {
    reveal();
    scheduleFade(delay);
  };

  return {
    reveal,
    revealTemporarily,
    scheduleFade
  };
}

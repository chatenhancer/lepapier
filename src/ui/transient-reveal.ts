export interface TransientRevealController {
  reveal(): void;
  revealTemporarily(delay?: number): void;
  scheduleFade(delay?: number): void;
}

export interface TransientRevealOptions {
  asleepClassName?: string | null;
  awakeClassName?: string;
  elements: HTMLElement[];
  shouldStayRevealed?(): boolean;
  windowTarget?: Window;
}

export function createTransientReveal({
  asleepClassName = 'is-asleep',
  awakeClassName = 'is-awake',
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

  const scheduleFade = (delay = 1800) => {
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

  const revealTemporarily = (delay = 1800) => {
    reveal();
    scheduleFade(delay);
  };

  return {
    reveal,
    revealTemporarily,
    scheduleFade
  };
}

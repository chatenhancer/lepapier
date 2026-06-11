export interface SaveStateFeedback {
  show(text: string, options?: { feedback?: boolean }): void;
}

export interface CopyButtonFeedback {
  show(button: HTMLButtonElement): void;
}

export function createSaveStateFeedback({
  element,
  feedbackMs = 760,
  windowTarget = window
}: {
  element: HTMLElement;
  feedbackMs?: number;
  windowTarget?: Window;
}): SaveStateFeedback {
  let feedbackTimeout = 0;

  return {
    show(text, { feedback = false } = {}) {
      element.textContent = text;
      if (!feedback) return;

      windowTarget.clearTimeout(feedbackTimeout);
      element.classList.remove('is-feedback');
      void element.offsetWidth;
      element.classList.add('is-feedback');
      feedbackTimeout = windowTarget.setTimeout(() => {
        element.classList.remove('is-feedback');
      }, feedbackMs);
    }
  };
}

export function createCopyButtonFeedback({
  feedbackMs,
  windowTarget = window
}: {
  feedbackMs: number;
  windowTarget?: Window;
}): CopyButtonFeedback {
  let feedbackTimeout = 0;

  return {
    show(button) {
      windowTarget.clearTimeout(feedbackTimeout);
      button.classList.add('is-copied');
      button.setAttribute('aria-label', 'Copied generated markdown');
      button.title = 'Copied';

      feedbackTimeout = windowTarget.setTimeout(() => {
        button.classList.remove('is-copied');
        button.setAttribute('aria-label', 'Copy generated markdown');
        button.title = 'Copy';
      }, feedbackMs);
    }
  };
}

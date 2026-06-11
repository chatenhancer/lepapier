type BeforeInstallPromptChoice = {
  outcome: 'accepted' | 'dismissed';
  platform: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptChoice>;
};

export function registerPwa(): void {
  const installButton = document.querySelector<HTMLButtonElement>('[data-install-app]');
  let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;

  const hideInstallButton = (): void => {
    if (!installButton) return;
    installButton.hidden = true;
  };

  hideInstallButton();

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event as BeforeInstallPromptEvent;

    if (installButton) {
      installButton.hidden = false;
    }
  });

  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    hideInstallButton();
  });

  installButton?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;

    const promptEvent = deferredInstallPrompt;
    deferredInstallPrompt = null;
    hideInstallButton();

    await promptEvent.prompt();
    await promptEvent.userChoice.catch(() => undefined);
  });

  if (!canRegisterServiceWorker()) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js', { scope: './' }).catch((error: unknown) => {
      console.warn('Lepapier service worker registration failed.', error);
    });
  });
}

function canRegisterServiceWorker(): boolean {
  return (
    import.meta.env.PROD &&
    'serviceWorker' in navigator &&
    window.isSecureContext &&
    window.location.protocol !== 'file:'
  );
}

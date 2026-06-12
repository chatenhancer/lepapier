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
  const updatePrompt = document.querySelector<HTMLElement>('[data-pwa-update]');
  const updateReloadButton = document.querySelector<HTMLButtonElement>('[data-pwa-update-reload]');
  let deferredInstallPrompt: BeforeInstallPromptEvent | null = null;
  let didShowUpdatePrompt = false;

  const hideInstallButton = (): void => {
    if (!installButton) return;
    installButton.hidden = true;
  };

  const showUpdatePrompt = (): void => {
    if (!updatePrompt || didShowUpdatePrompt) return;

    didShowUpdatePrompt = true;
    updatePrompt.hidden = false;
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
  updateReloadButton?.addEventListener('click', () => {
    window.location.reload();
  });

  if (!canRegisterServiceWorker()) return;

  const serviceWorkerUrl = `service-worker.js?v=${encodeURIComponent(__LEPAPIER_BUILD_TIMESTAMP__)}`;
  const hadServiceWorkerController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadServiceWorkerController || !navigator.serviceWorker.controller) return;

    showUpdatePrompt();
  });

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register(serviceWorkerUrl, { scope: './', updateViaCache: 'none' })
      .then((registration) => {
        if (hadServiceWorkerController && registration.waiting && navigator.serviceWorker.controller) {
          showUpdatePrompt();
        }
        registration.addEventListener('updatefound', () => {
          const installingWorker = registration.installing;
          installingWorker?.addEventListener('statechange', () => {
            if (hadServiceWorkerController && installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdatePrompt();
            }
          });
        });
        return registration.update().catch(() => undefined);
      })
      .catch((error: unknown) => {
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

export type MobilePanel = 'documents' | 'settings';

export interface MobilePanelsController {
  close(): void;
  isMobileLayout(): boolean;
  update(): void;
}

export interface MobilePanelsOptions {
  body?: HTMLElement;
  documentsToggle: HTMLButtonElement;
  mediaQuery: MediaQueryList;
  onLayoutChange?(): void;
  settingsToggle: HTMLButtonElement;
}

const documentsPanelClassName = 'is-documents-panel-open';
const settingsPanelClassName = 'is-settings-panel-open';

export function setupMobilePanels({
  body = document.body,
  documentsToggle,
  mediaQuery,
  onLayoutChange,
  settingsToggle
}: MobilePanelsOptions): MobilePanelsController {
  const isMobileLayout = () => mediaQuery.matches;

  const update = () => {
    const documentsOpen = body.classList.contains(documentsPanelClassName);
    const settingsOpen = body.classList.contains(settingsPanelClassName);

    documentsToggle.setAttribute('aria-expanded', String(documentsOpen));
    documentsToggle.textContent = documentsOpen ? 'Hide documents' : 'Documents';

    settingsToggle.setAttribute('aria-expanded', String(settingsOpen));
    settingsToggle.textContent = settingsOpen ? 'Hide settings' : 'Settings';
  };

  const close = () => {
    body.classList.remove(documentsPanelClassName, settingsPanelClassName);
    update();
  };

  const toggle = (panel: MobilePanel) => {
    if (!isMobileLayout()) return;

    const panelClassName = panel === 'documents' ? documentsPanelClassName : settingsPanelClassName;
    const panelIsOpen = body.classList.contains(panelClassName);
    close();

    if (!panelIsOpen) {
      body.classList.add(panelClassName);
    }
    update();
  };

  documentsToggle.addEventListener('click', () => {
    toggle('documents');
  });
  settingsToggle.addEventListener('click', () => {
    toggle('settings');
  });
  mediaQuery.addEventListener('change', () => {
    onLayoutChange?.();
    if (!isMobileLayout()) {
      close();
      return;
    }
    update();
  });
  update();

  return {
    close,
    isMobileLayout,
    update
  };
}

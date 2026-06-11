export interface ThemeAppConfig {
  buildTooltip: string;
  homeHref: string;
  iconSrc: string;
  displayVersion: string;
  logoDarkSrc: string;
  logoSrc: string;
  name: string;
  releaseNotesHref: string;
}

export interface ThemeControllerOptions {
  appConfig: ThemeAppConfig;
  darkThemeColor: string;
  documentTarget?: Document;
  lightThemeColor: string;
  storageKey: string;
  themeToggle: HTMLButtonElement;
  windowTarget?: Window;
}

interface SetThemeOptions {
  appConfig: ThemeAppConfig;
  darkThemeColor: string;
  documentTarget: Document;
  lightThemeColor: string;
  persist: boolean;
  storageKey: string;
  themeToggle: HTMLButtonElement;
  windowTarget: Window;
}

export function setupThemeController({
  appConfig,
  darkThemeColor,
  documentTarget = document,
  lightThemeColor,
  storageKey,
  themeToggle,
  windowTarget = window
}: ThemeControllerOptions): void {
  applyAppConfig(appConfig, documentTarget);

  const systemTheme = windowTarget.matchMedia('(prefers-color-scheme: dark)');
  const savedTheme = windowTarget.localStorage.getItem(storageKey);
  setTheme(savedTheme || (systemTheme.matches ? 'dark' : 'light'), {
    appConfig,
    darkThemeColor,
    documentTarget,
    lightThemeColor,
    persist: false,
    storageKey,
    themeToggle,
    windowTarget
  });
  systemTheme.addEventListener('change', (event) => {
    if (windowTarget.localStorage.getItem(storageKey)) return;
    setTheme(event.matches ? 'dark' : 'light', {
      appConfig,
      darkThemeColor,
      documentTarget,
      lightThemeColor,
      persist: false,
      storageKey,
      themeToggle,
      windowTarget
    });
  });

  themeToggle.addEventListener('click', () => {
    const nextTheme = documentTarget.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme, {
      appConfig,
      darkThemeColor,
      documentTarget,
      lightThemeColor,
      persist: true,
      storageKey,
      themeToggle,
      windowTarget
    });
  });
}

function applyAppConfig(appConfig: ThemeAppConfig, documentTarget: Document): void {
  documentTarget.title = appConfig.name;

  for (const icon of documentTarget.querySelectorAll('[data-app-icon]')) {
    icon.setAttribute('href', appConfig.iconSrc);
  }

  const brandLink = documentTarget.querySelector('[data-app-home]');
  if (brandLink) {
    brandLink.setAttribute('href', appConfig.homeHref);
    brandLink.setAttribute('aria-label', `${appConfig.name} home`);
  }

  const brandLogos = documentTarget.querySelectorAll<HTMLImageElement>('[data-app-logo]');
  for (const brandLogo of brandLogos) {
    brandLogo.setAttribute('alt', '');
  }
  for (const versionElement of documentTarget.querySelectorAll('[data-app-version]')) {
    versionElement.textContent = appConfig.displayVersion;
  }
  for (const buildTooltipElement of documentTarget.querySelectorAll<HTMLElement>('[data-app-build-tooltip]')) {
    buildTooltipElement.dataset.tooltip = appConfig.buildTooltip;
    buildTooltipElement.setAttribute('aria-label', `${appConfig.displayVersion}. ${appConfig.buildTooltip}`);
  }
  for (const releaseNotesLink of documentTarget.querySelectorAll<HTMLAnchorElement>('[data-app-release-notes]')) {
    releaseNotesLink.href = appConfig.releaseNotesHref;
  }
  updateThemeLogo(appConfig, documentTarget);
}

function setTheme(
  theme: string,
  {
    appConfig,
    darkThemeColor,
    documentTarget,
    lightThemeColor,
    persist,
    storageKey,
    themeToggle,
    windowTarget
  }: SetThemeOptions
): void {
  const normalizedTheme = normalizeTheme(theme);
  documentTarget.documentElement.dataset.theme = normalizedTheme;
  documentTarget.querySelector('meta[name="theme-color"]')?.setAttribute('content', normalizedTheme === 'dark' ? darkThemeColor : lightThemeColor);
  updateThemeLogo(appConfig, documentTarget);
  themeToggle.setAttribute('aria-pressed', String(normalizedTheme === 'dark'));
  themeToggle.textContent = normalizedTheme === 'dark' ? 'Light mode' : 'Dark mode';
  if (persist) {
    windowTarget.localStorage.setItem(storageKey, normalizedTheme);
  }
}

function updateThemeLogo(appConfig: ThemeAppConfig, documentTarget: Document): void {
  for (const brandLogo of documentTarget.querySelectorAll<HTMLImageElement>('[data-app-logo]')) {
    brandLogo.src = brandLogo.dataset.appLogo === 'dark' ? appConfig.logoDarkSrc : appConfig.logoSrc;
  }
}

export function normalizeTheme(theme: string): 'dark' | 'light' {
  return theme === 'dark' ? 'dark' : 'light';
}

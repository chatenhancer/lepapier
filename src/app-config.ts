import packageJson from '../package.json' with { type: 'json' };

const buildTimestamp = __LEPAPIER_BUILD_TIMESTAMP__;

export const appConfig = {
  buildTimestamp,
  buildTooltip: `Build date: ${buildTimestamp}`,
  displayVersion: `lepapier.app v${packageJson.version}`,
  homeHref: 'https://lepapier.app',
  iconSrc: '/assets/icons/lepapier.svg',
  logoDarkSrc: '/assets/icons/lepapier-dark.svg',
  logoSrc: '/assets/icons/lepapier.svg',
  metadataContext: 'a public article',
  name: 'Lepapier',
  releaseNotesHref: 'https://github.com/chatenhancer/lepapier/releases',
  storageNamespace: 'lepapier'
} as const;

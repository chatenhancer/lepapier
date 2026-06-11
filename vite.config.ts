import { readFileSync } from 'node:fs';
import { extname } from 'node:path';
import type { OutputAsset, OutputBundle, OutputChunk } from 'rollup';
import sharp from 'sharp';
import { defineConfig, type Plugin } from 'vite';

type PackageMetadata = {
  license?: string;
  name: string;
  version: string;
};

const appHomepage = 'https://lepapier.app';
const packageMetadata = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as PackageMetadata;
const buildTimestamp = new Date().toISOString();
const pwaIconFiles = ['pwa-icon-192.png', 'pwa-icon-512.png', 'pwa-maskable-512.png'];
const pwaCompanionFiles = new Set(['manifest.webmanifest', 'service-worker.js', ...pwaIconFiles]);

function portableHtmlBuildPlugin(): Plugin {
  return {
    name: 'lepapier-portable-html-build',
    apply: 'build',
    enforce: 'post',
    async generateBundle(_options, bundle) {
      const htmlAsset = Object.values(bundle).find(
        (entry): entry is OutputAsset => entry.type === 'asset' && entry.fileName === 'index.html'
      );

      if (!htmlAsset) {
        this.error('Could not find index.html in the build output.');
        return;
      }

      let html = sourceToString(htmlAsset.source);
      html = removeFontPreloads(html);
      html = inlineStylesheets(html, bundle);
      html = moveStylesAfterThemeBootstrap(html);
      html = inlineEntryScripts(html, bundle);
      html = moveModuleScriptsToEndOfHead(html);
      html = inlinePublicAssetReferences(html);
      html = prependBuildMetadata(minifyPortableHtml(html));

      htmlAsset.source = html;
      await addPwaCompanionAssets(bundle);

      for (const fileName of Object.keys(bundle)) {
        if (fileName !== htmlAsset.fileName && !pwaCompanionFiles.has(fileName)) {
          delete bundle[fileName];
        }
      }
    }
  };
}

function removeFontPreloads(html: string): string {
  return html.replace(
    /^\s*<link\b(?=[^>]*\brel=["']preload["'])(?=[^>]*\bhref=["']\/assets\/fonts\/InterVariable\.woff2["'])[^>]*>\n?/gm,
    ''
  );
}

function inlineStylesheets(html: string, bundle: OutputBundle): string {
  for (const asset of Object.values(bundle)) {
    if (!isAsset(asset) || !asset.fileName.endsWith('.css')) continue;

    const hrefPattern = assetReferencePattern(asset.fileName);
    const stylesheetPattern = new RegExp(
      String.raw`\s*<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']${hrefPattern}["'])[^>]*>\n?`,
      'g'
    );
    const css = sourceToString(asset.source).replace(/<\/style/gi, '<\\/style');
    html = html.replace(stylesheetPattern, () => `<style>${css}</style>`);
  }

  return html;
}

function moveStylesAfterThemeBootstrap(html: string): string {
  const styles: string[] = [];
  const htmlWithoutStyles = html.replace(/\s*<style>[\s\S]*?<\/style>\s*/gi, (style) => {
    styles.push(style.trim());
    return '';
  });

  if (!styles.length) return html;

  const styleBlock = styles.join('');
  const headEnd = htmlWithoutStyles.indexOf('</head>');
  const firstScriptEnd = htmlWithoutStyles.indexOf('</script>');
  if (firstScriptEnd !== -1 && (headEnd === -1 || firstScriptEnd < headEnd)) {
    const insertionPoint = firstScriptEnd + '</script>'.length;
    return `${htmlWithoutStyles.slice(0, insertionPoint)}${styleBlock}${htmlWithoutStyles.slice(insertionPoint)}`;
  }

  const headStart = htmlWithoutStyles.indexOf('<head>');
  if (headStart !== -1) {
    const insertionPoint = headStart + '<head>'.length;
    return `${htmlWithoutStyles.slice(0, insertionPoint)}${styleBlock}${htmlWithoutStyles.slice(insertionPoint)}`;
  }

  return `${styleBlock}${htmlWithoutStyles}`;
}

function inlineEntryScripts(html: string, bundle: OutputBundle): string {
  for (const chunk of Object.values(bundle)) {
    if (!isChunk(chunk) || !chunk.isEntry) continue;

    const srcPattern = assetReferencePattern(chunk.fileName);
    const scriptPattern = new RegExp(
      String.raw`\s*<script\b(?=[^>]*\bsrc=["']${srcPattern}["'])[^>]*></script>\n?`,
      'g'
    );
    const code = chunk.code.replace(/<\/script/gi, '<\\/script');
    html = html.replace(scriptPattern, () => `<script type="module">${code}</script>`);
  }

  return html;
}

function moveModuleScriptsToEndOfHead(html: string): string {
  const moduleScripts: string[] = [];
  let htmlWithoutModuleScripts = html.replace(
    /\s*<script\b(?=[^>]*\btype=["']module["'])[\s\S]*?<\/script>\s*/gi,
    (script) => {
      moduleScripts.push(script.trim());
      return '';
    }
  );

  if (!moduleScripts.length) return html;

  const scripts = moduleScripts.join('');
  const headEnd = htmlWithoutModuleScripts.indexOf('</head>');
  if (headEnd !== -1) {
    return `${htmlWithoutModuleScripts.slice(0, headEnd)}${scripts}${htmlWithoutModuleScripts.slice(headEnd)}`;
  }

  const insertionPoint = htmlWithoutModuleScripts.lastIndexOf('</style>');
  if (insertionPoint === -1) return `${htmlWithoutModuleScripts}${scripts}`;

  htmlWithoutModuleScripts = `${htmlWithoutModuleScripts.slice(0, insertionPoint + '</style>'.length)}${scripts}${htmlWithoutModuleScripts.slice(insertionPoint + '</style>'.length)}`;
  return htmlWithoutModuleScripts;
}

function inlinePublicAssetReferences(html: string): string {
  const assets = [
    '/assets/fonts/InterVariable.woff2',
    '/assets/icons/lepapier.svg',
    '/assets/icons/lepapier-dark.svg'
  ];

  for (const assetPath of assets) {
    html = html.replaceAll(assetPath, fileToDataUri(new URL(`./public${assetPath}`, import.meta.url)));
  }

  return html;
}

function minifyPortableHtml(html: string): string {
  const preservedBlocks: string[] = [];
  const preserveBlock = (block: string): string => {
    const placeholder = `LEPAPIER_PRESERVED_BLOCK_${preservedBlocks.length}`;
    preservedBlocks.push(block);
    return placeholder;
  };

  let minified = html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, preserveBlock)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/>\s+</g, '><')
    .replace(/\s+([/>])/g, '$1')
    .trim();

  preservedBlocks.forEach((block, index) => {
    minified = minified.replace(`LEPAPIER_PRESERVED_BLOCK_${index}`, () => block);
  });

  return minified;
}

function prependBuildMetadata(html: string): string {
  const metadata = [
    'Lepapier portable build',
    `Version: ${packageMetadata.version}`,
    `Homepage: ${appHomepage}`,
    `License: ${packageMetadata.license ?? 'unknown'}`,
    `Built: ${buildTimestamp}`,
    'Format: self-contained HTML app shell; companion manifest/service-worker enable hosted PWA offline caching.'
  ];

  return `<!--\n${metadata.join('\n')}\n-->\n${html}`;
}

async function addPwaCompanionAssets(bundle: OutputBundle): Promise<void> {
  addTextAsset(bundle, 'manifest.webmanifest', createWebManifest());
  addTextAsset(bundle, 'service-worker.js', createServiceWorker());
  addBinaryAsset(bundle, 'pwa-icon-192.png', await createPwaIconPng(192, 0.86));
  addBinaryAsset(bundle, 'pwa-icon-512.png', await createPwaIconPng(512, 0.86));
  addBinaryAsset(bundle, 'pwa-maskable-512.png', await createPwaIconPng(512, 0.72));
}

function addTextAsset(bundle: OutputBundle, fileName: string, source: string): void {
  bundle[fileName] = {
    type: 'asset',
    fileName,
    name: undefined,
    originalFileName: null,
    source,
    needsCodeReference: false,
    names: [],
    originalFileNames: []
  };
}

function addBinaryAsset(bundle: OutputBundle, fileName: string, source: Uint8Array): void {
  bundle[fileName] = {
    type: 'asset',
    fileName,
    name: undefined,
    originalFileName: null,
    source,
    needsCodeReference: false,
    names: [],
    originalFileNames: []
  };
}

function createWebManifest(): string {
  return `${JSON.stringify({
    name: 'Lepapier',
    short_name: 'Lepapier',
    description: 'A local-first Markdown writing app.',
    id: '.',
    start_url: '.',
    scope: '.',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      {
        src: 'pwa-icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: 'pwa-icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: 'pwa-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable'
      }
    ]
  })}\n`;
}

function createServiceWorker(): string {
  const cacheName = `lepapier-${packageMetadata.version}-${buildTimestamp}`;
  const appShell = ['./', 'index.html', 'manifest.webmanifest', ...pwaIconFiles];

  return minifyGeneratedScript(`
const CACHE_NAME=${JSON.stringify(cacheName)};
const APP_SHELL=${JSON.stringify(appShell)};
const APP_INDEX=new URL("index.html",self.location.href).href;
const APP_ROOT=new URL("./",self.location.href).href;
self.addEventListener("install",(event)=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE_NAME);
    await Promise.all(APP_SHELL.map(async(url)=>{
      try {
        const response=await fetch(url,{cache:"reload"});
        if(response.ok) await cache.put(url,response);
      } catch {}
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate",(event)=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter((key)=>key.startsWith("lepapier-")&&key!==CACHE_NAME).map((key)=>caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",(event)=>{
  const request=event.request;
  if(request.method!=="GET") return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;
  if(request.mode==="navigate"){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE_NAME);
      try {
        const response=await fetch(request,{cache:"reload"});
        if(response.ok) await cache.put(APP_INDEX,response.clone());
        return response;
      } catch {
        return (await cache.match(APP_INDEX))||(await cache.match(APP_ROOT))||Response.error();
      }
    })());
    return;
  }
  event.respondWith((async()=>{
    const cached=await caches.match(request);
    if(cached) return cached;
    try {
      const response=await fetch(request);
      if(response.ok){
        const cache=await caches.open(CACHE_NAME);
        await cache.put(request,response.clone());
      }
      return response;
    } catch {
      return Response.error();
    }
  })());
});
`);
}

function minifyGeneratedScript(script: string): string {
  return script
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}[\]();,:=><!+*&|?/-])\s*/g, '$1')
    .trim();
}

function fileToDataUri(fileUrl: URL): string {
  const mediaType = mediaTypeForPath(fileUrl.pathname);
  const data = readFileSync(fileUrl).toString('base64');
  return `data:${mediaType};base64,${data}`;
}

async function createPwaIconPng(size: number, scale: number): Promise<Uint8Array> {
  const iconSize = Math.round(size * scale);
  const icon = await sharp(readFileSync(new URL('./public/assets/icons/lepapier.svg', import.meta.url)))
    .resize(iconSize, iconSize, {
      background: { r: 255, g: 255, b: 255, alpha: 0 },
      fit: 'contain'
    })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    }
  })
    .composite([{ input: icon, gravity: 'center' }])
    .png()
    .toBuffer();
}

function mediaTypeForPath(filePath: string): string {
  switch (extname(filePath)) {
    case '.svg':
      return 'image/svg+xml';
    case '.woff2':
      return 'font/woff2';
    default:
      return 'application/octet-stream';
  }
}

function assetReferencePattern(fileName: string): string {
  return String.raw`(?:\.?\/)?${escapeRegExp(fileName)}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sourceToString(source: OutputAsset['source']): string {
  return typeof source === 'string' ? source : Buffer.from(source).toString('utf8');
}

function isAsset(entry: OutputAsset | OutputChunk): entry is OutputAsset {
  return entry.type === 'asset';
}

function isChunk(entry: OutputAsset | OutputChunk): entry is OutputChunk {
  return entry.type === 'chunk';
}

export default defineConfig({
  build: {
    copyPublicDir: false,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      }
    },
    sourcemap: false
  },
  define: {
    __LEPAPIER_BUILD_TIMESTAMP__: JSON.stringify(buildTimestamp)
  },
  plugins: [portableHtmlBuildPlugin()],
  preview: {
    host: '127.0.0.1'
  },
  server: {
    host: '127.0.0.1'
  }
});

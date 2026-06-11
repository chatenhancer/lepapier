import { defineConfig } from 'astro/config';

export default defineConfig({
  build: {
    format: 'directory'
  },
  compressHTML: true,
  devToolbar: {
    enabled: false
  },
  outDir: './dist/docs',
  publicDir: './docs/public',
  site: 'https://lepapier.app',
  srcDir: './docs/src',
  trailingSlash: 'always'
});

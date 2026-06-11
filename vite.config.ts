import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    sourcemap: true
  },
  preview: {
    host: '127.0.0.1'
  },
  server: {
    host: '127.0.0.1'
  }
});

import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
  },
  server: {
    host: '127.0.0.1',
    port: 3000,
    strictPort: true,
    open: true,
    fs: {
      strict: false,
    },
  },
});

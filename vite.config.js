import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three')) return 'vendor-three';
          if (id.includes('node_modules/gsap')) return 'vendor-gsap';
          if (id.includes('node_modules/cannon-es')) return 'vendor-cannon';
          if (id.includes('node_modules')) return 'vendor';
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5500,
    strictPort: true,
    open: true,
    fs: {
      strict: false,
    },
  },
});

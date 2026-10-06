import { defineConfig } from 'vite';

export default defineConfig({
  // Relative base so the built site works from any sub-path (e.g. la.jinfei.co.uk/game/).
  base: './',
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { target: 'es2022', sourcemap: true, chunkSizeWarningLimit: 1600 },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';

// Task 11.5.2 — the dev server is served over HTTPS with a locally-trusted
// certificate (vite-plugin-mkcert) and proxies /api to the HTTPS Express
// backend. `secure: false` lets the proxy accept the backend's locally-trusted
// self-signed certificate on localhost.
export default defineConfig({
  root: 'web',
  // Emit the production build to <repo>/dist (not web/dist) so static hosts
  // that default to a root-level `dist` folder (e.g. Vercel) work with no
  // extra configuration.
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
  plugins: [react(), mkcert()],
  server: {
    port: 5173,
    https: true,
    proxy: {
      '/api': {
        target: 'https://localhost:3001',
        changeOrigin: true,
        // Accept the backend's locally-trusted self-signed cert on localhost.
        secure: false,
      },
    },
  },
  test: {
    globals: true,
    environment: 'node',
    // React component tests override the environment per-file via a
    // `// @vitest-environment jsdom` pragma.
  },
});

import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Dedicated Vitest config governing tests across the WHOLE repo (server + web + shared).
// Kept separate from vite.config.ts (whose root is 'web' for the dev server) so that
// backend tests under server/ are always discovered. Single source of truth for tests.
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    root: '.',
    include: [
      'server/**/*.test.ts',
      'web/**/*.test.ts',
      'web/**/*.test.tsx',
      'shared/**/*.test.ts',
    ],
    // React component tests opt into jsdom per-file via // @vitest-environment jsdom.
  },
});

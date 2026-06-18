import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // Force development mode so React.act is available in tests.
    // React 19.1+ removed act from the production build.
    'process.env.NODE_ENV': JSON.stringify('development'),
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    env: {
      NODE_ENV: 'development',
    },
  },
});

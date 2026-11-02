import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages: https://<konto>.github.io/thex-finanzplan/
export default defineConfig({
  plugins: [react()],
  base: '/thex-finanzplan/',
  build: { chunkSizeWarningLimit: 1200 },
  test: { environment: 'node' },
} as any);

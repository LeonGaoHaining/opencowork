import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';

const projectRoot = path.resolve(__dirname);
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf-8'));
const APP_VERSION = packageJson.version;

const versionJsContent = `window.__APP_VERSION__ = ${JSON.stringify(APP_VERSION)};\n`;
fs.writeFileSync(path.join(projectRoot, 'src/renderer/public/version.js'), versionJsContent);

export default defineConfig({
  plugins: [react()],
  base: './',
  root: 'src/renderer',
  publicDir: 'public',
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        main: './src/renderer/index.html',
        preview: './src/renderer/preview.html',
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/renderer/setupTests.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'src/renderer/setupTests.ts'],
    },
  },
});

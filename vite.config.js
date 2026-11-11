import { defineConfig } from 'vite';
export default defineConfig({
  root: '.',
  base: './',
  build: { outDir: 'dist', rollupOptions: { input: { demo: 'demo/index.html' } } },
  server: { host: true },
  test: { include: ['tests/unit/**/*.test.js'], environment: 'node' },
});

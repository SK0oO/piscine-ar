// Construction 1/2 : le composant en UN fichier ES (dist/piscine-ar.js), Three.js inclus.
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: { entry: 'src/index.js', formats: ['es'], fileName: () => 'piscine-ar.js' },
  },
});

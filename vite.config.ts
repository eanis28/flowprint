import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { copyFileSync, cpSync, mkdirSync } from 'node:fs';
export default defineConfig({
  build: { outDir: 'dist', emptyOutDir: true, rollupOptions: { input: {
    background: resolve(import.meta.dirname, 'src/background.ts'), content: resolve(import.meta.dirname, 'src/content.ts'),
    popup: resolve(import.meta.dirname, 'popup.html'), viewer: resolve(import.meta.dirname, 'viewer.html')
  }, output: { entryFileNames: 'assets/[name].js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]' } } },
  plugins: [{ name: 'manifest', closeBundle() {
    copyFileSync('manifest.json', 'dist/manifest.json');
    mkdirSync('dist/icons', { recursive: true });
    cpSync('icons', 'dist/icons', { recursive: true });
  } }]
});

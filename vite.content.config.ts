import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  publicDir: false,

  build: {
    outDir: 'dist',
    emptyOutDir: false,

    sourcemap: true,

    lib: {
      entry: fileURLToPath(
        new URL(
          './src/content/index.ts',
          import.meta.url
        )
      ),

      name: 'ChessPracticeContent',

      formats: ['iife'],

      fileName: () => 'content.js'
    }
  }
});
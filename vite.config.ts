import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],

  publicDir: 'public',

  input: {
    background: fileURLToPath(
      new URL(
        './src/background/service-worker.ts',
        import.meta.url
      )
    ),

    offscreen: fileURLToPath(
      new URL(
        './src/offscreen/index.ts',
        import.meta.url
      )
    ),

    popup: fileURLToPath(
      new URL(
        './src/popup/main.tsx',
        import.meta.url
      )
    )
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,

    rolldownOptions: {
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]'
      }
    }
  }
});

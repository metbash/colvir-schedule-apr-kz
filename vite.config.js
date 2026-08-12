import { defineConfig } from 'vite';

export default defineConfig({
  // base: './' позволяет открывать dist/index.html напрямую без сервера
  base: './',
  build: {
    outDir: 'dist',
    // Один бандл для JS и один для CSS
    rollupOptions: {
      output: {
        manualChunks: undefined
      }
    }
  }
});

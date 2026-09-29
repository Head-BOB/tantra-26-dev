import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Tantra 26 — Vite multi-page configuration.
 * Each HTML file in the `input` map is an independent entry point.
 * Vite will tree-shake and bundle only what each page actually uses.
 */
export default defineConfig({
  root: '.',
  base: '/',

  build: {
    rollupOptions: {
      input: {
        // Landing page
        main: resolve(__dirname, 'index.html'),
        // Department pages
        deptAi:    resolve(__dirname, 'departments/ai.html'),
        deptCse:   resolve(__dirname, 'departments/cse.html'),
        deptCivil: resolve(__dirname, 'departments/civil.html'),
        deptMech:  resolve(__dirname, 'departments/mech.html'),
        deptEee:   resolve(__dirname, 'departments/eee.html'),
        // Admin dashboard
        admin: resolve(__dirname, 'admin/index.html'),
      },
      output: {
        // Group all shared chunks under assets/
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
        entryFileNames: 'assets/[name]-[hash].js',
      },
    },
  },

  server: {
    port: 5173,
    open: true,
  },
});

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
        // My Events page
        myEvents: resolve(__dirname, 'my-events.html'),
        // Department pages
        deptAi:    resolve(__dirname, 'departments/ai.html'),
        deptCse:   resolve(__dirname, 'departments/cse.html'),
        deptCsd:   resolve(__dirname, 'departments/csd.html'),
        deptCsbs:  resolve(__dirname, 'departments/csbs.html'),
        deptCivil: resolve(__dirname, 'departments/civil.html'),
        deptMech:  resolve(__dirname, 'departments/mech.html'),
        deptEee:   resolve(__dirname, 'departments/eee.html'),
        deptEce:   resolve(__dirname, 'departments/ece.html'),
        deptAei:   resolve(__dirname, 'departments/aei.html'),
        deptCscy:  resolve(__dirname, 'departments/cscy.html'),
        // Admin dashboard
        admin: resolve(__dirname, 'admin/index.html'),
        // Organisers portal & Event management
        organisers: resolve(__dirname, 'organisers.html'),
        organiserEvent: resolve(__dirname, 'organiser-event.html'),
        // Public full client event page
        event: resolve(__dirname, 'event.html'),
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
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});

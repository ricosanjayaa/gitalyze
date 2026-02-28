import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import mdx from '@mdx-js/rollup';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig({
  plugins: [Object.assign(mdx(), { enforce: 'pre' as const }), react(), tailwindcss()],
  define: {
    // API key is no longer exposed to client - only available server-side
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // HMR is disabled in AI Studio via DISABLE_HMR env var.
    // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
    hmr: process.env.DISABLE_HMR !== 'true',
  },
});

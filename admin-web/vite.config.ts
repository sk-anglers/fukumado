import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/admin/api': {
        target: 'http://localhost:4001',
        changeOrigin: true
      },
      '/admin/ws': {
        target: 'ws://localhost:4001',
        ws: true
      }
    }
  },
  preview: {
    port: 4174
  }
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const isProd = process.env.NODE_ENV === 'production';

export default defineConfig({
  plugins: [react()],
  base: isProd ? '/sales-territory-performance-platform/' : '/',
  resolve: { alias: { '@': '/src' } },
  server: { port: 5173 },
});

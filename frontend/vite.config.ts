import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'real-ip-detector',
        configureServer(server) {
          server.middlewares.use('/api/real-ip', (req, res) => {
            const forwarded = req.headers['x-forwarded-for'];
            const clientIp = typeof forwarded === 'string' 
              ? forwarded.split(',')[0].trim() 
              : (req.socket.remoteAddress || '127.0.0.1');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ 
              ip: clientIp, 
              headers: {
                'x-forwarded-for': forwarded,
              },
              timestamp: Date.now() 
            }));
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8000',
          changeOrigin: true,
          bypass: (req) => {
            if (req.url && req.url.startsWith('/api/real-ip')) {
              return req.url;
            }
          },
        },
      },
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});

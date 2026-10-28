import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const backend = 'http://127.0.0.1:' + (process.env.MONTHWISE_API_PORT || '8787');
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: backend,
        changeOrigin: true,
        configure(proxy) {
          proxy.on('proxyReq', (outgoing, incoming) => {
            // Rewrite only a genuinely same-origin dev request; foreign origins stay foreign and are rejected.
            const origin = incoming.headers.origin;
            if (origin && origin === 'http://' + incoming.headers.host)
              outgoing.setHeader('origin', backend);
          });
        },
      },
    },
  },
});

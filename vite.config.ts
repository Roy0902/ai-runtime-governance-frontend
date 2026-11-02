import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

type NodeRuntimeGlobal = typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
};
const backendTarget = (globalThis as NodeRuntimeGlobal).process?.env?.GOVERNANCE_BACKEND_URL
  ?? 'http://127.0.0.1:8080';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: false,
      },
    },
  },
});

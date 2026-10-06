import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react()],
    server: {
      port: 3000,
      strictPort: true,
      proxy: { '/api': `http://127.0.0.1:${env.PORT || 5000}` }
    },
    build: { sourcemap: false },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{js,jsx}'],
      setupFiles: ['src/test/setup.js'],
      clearMocks: true,
      restoreMocks: true
    }
  };
});

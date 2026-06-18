import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
// import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), /* PWA disabled temporarily to fix payment return white screen */],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    build: {
      sourcemap: false,
      reportCompressedSize: false,
      cssCodeSplit: true,
      target: 'es2020',
      chunkSizeWarningLimit: 1200,
      modulePreload: { polyfill: false },
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('firebase/')) return 'vendor-firebase';
            if (id.includes('@google/genai')) return 'vendor-ai';
            if (id.includes('motion')) return 'vendor-motion';
            if (id.includes('lucide-react')) return 'vendor-icons';
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) return 'vendor-react';
            return 'vendor-misc';
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  };
});

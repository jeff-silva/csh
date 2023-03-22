import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
// import { env } from 'process';

// https://vitejs.dev/config/
export default defineConfig((params) => {
  
  const env = loadEnv(params.mode, process.cwd(), '');

  return {
    plugins: [
      vue(),
      (() => {
        return {
          name: 'custom',
          enforce: 'post',
          handleHotUpdate({ file, server }) {
            if (file.endsWith('.js')) {
              server.ws.send({ type: 'full-reload', path: '*' });
            }
          },
        };
      })(),
    ],
  
    server: {
      port: env.VITE_PORT,
    },
  
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
  
    build: {
      manifest: true,
      emptyOutDir: true,
    },
  };
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron/simple';
import path from 'node:path';

export default defineConfig(({ command }) => {
  const isDev = command === 'serve';

  return {
    plugins: [
      react(),
      electron({
        main: {
          entry: 'electron/main.ts',
          vite: {
            build: {
              outDir: 'dist-electron',
              sourcemap: isDev,
              minify: !isDev,
              rollupOptions: {
                external: ['electron', 'groq-sdk', 'dotenv'],
                output: {
                  format: 'cjs',
                  entryFileNames: '[name].js',
                },
              },
            },
            resolve: {
              alias: {
                '@shared': path.resolve(__dirname, 'shared'),
              },
            },
          },
        },
        preload: {
          input: 'electron/preload.ts',
          vite: {
            build: {
              outDir: 'dist-electron',
              sourcemap: isDev ? 'inline' : false,
              minify: !isDev,
              rollupOptions: {
                external: ['electron'],
                output: {
                  format: 'cjs',
                  entryFileNames: '[name].js',
                },
              },
            },
            resolve: {
              alias: {
                '@shared': path.resolve(__dirname, 'shared'),
              },
            },
          },
        },
        renderer: {},
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        '@shared': path.resolve(__dirname, 'shared'),
      },
    },
    server: {
      port: 5173,
      strictPort: true,
    },
    build: {
      outDir: 'dist',
      sourcemap: isDev,
      emptyOutDir: true,
    },
    clearScreen: false,
  };
});

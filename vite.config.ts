import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    vue(),
    dts({
      tsconfigPath: './tsconfig.json',
      outDir: 'dist',
      rollupTypes: true,
    }),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'libs'),
    },
  },
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'libs/index.ts'),
        audio: resolve(__dirname, 'libs/audio/index.ts'),
        styles: resolve(__dirname, 'libs/styles/entry.ts'),
      },
      formats: ['es'],
      fileName: (_, entryName) => `${entryName}.mjs`,
    },
    rollupOptions: {
      external: ['vue', 'howler'],
      output: {
        globals: {
          vue: 'Vue',
        },
        chunkFileNames: '[name].mjs',
        assetFileNames: (assetInfo) => {
          if (assetInfo.names?.[0]?.endsWith('.css') || assetInfo.name?.endsWith('.css'))
            return 'styles.css';
          return '[name][extname]';
        },
      },
    },
    cssCodeSplit: false,
  },
});

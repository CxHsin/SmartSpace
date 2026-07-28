import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const sourceRoot = resolve(import.meta.dirname, 'src');
const isPreload = process.env.VITE_BUILD_MODE === 'preload';
const entry = resolve(sourceRoot, isPreload ? 'preload/preload.ts' : 'main/main.ts');
const outputName = isPreload ? 'preload.cjs' : 'main.cjs';

export default defineConfig({
  build: {
    outDir: 'dist/electron',
    emptyOutDir: !isPreload,
    minify: false,
    lib: {
      entry,
      formats: ['cjs'],
      fileName: () => outputName,
    },
    rollupOptions: {
      external: ['electron', /^node:/],
      output: {
        format: 'cjs',
        inlineDynamicImports: true,
        entryFileNames: outputName,
      },
    },
  },
});

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'node:path';

// `vite build --mode single` makes one self-contained HTML file for Google Sites' "Embed code".
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    plugins: [react(), ...(single ? [viteSingleFile()] : [])],
    base: './',
    resolve: {
      alias: {
        // the embeddable build uses a compact (HE-AAC) copy of the battle theme
        '@lobby-theme': path.resolve(__dirname, single ? 'src/assets/music/lobby-small.m4a' : 'src/assets/music/lobby.m4a'),
        '@battle-theme': path.resolve(__dirname, single ? 'src/assets/music/chip-level-small.m4a' : 'src/assets/music/chip-level.mp3'),
      },
    },
    build: single
      ? { outDir: 'dist-single', assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 10_000 }
      : { chunkSizeWarningLimit: 2000, rollupOptions: { output: { manualChunks: { phaser: ['phaser'] } } } },
    test: { globals: true, environment: 'node' },
  } as any;
});

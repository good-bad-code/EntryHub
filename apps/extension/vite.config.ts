import { defineConfig, build, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const env = loadEnv('production', __dirname, '');

const alias = {
  '@entry-hub/core': path.resolve(__dirname, '../../packages/core/src/index.ts'),
  '@entry-hub/shared': path.resolve(__dirname, '../../packages/shared/src/index.ts'),
};

const commonDefine = {
  'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  'process.env': JSON.stringify({}),
  'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(env.VITE_SUPABASE_URL || ''),
  'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(env.VITE_SUPABASE_ANON_KEY || ''),
};

// Vite는 단일 설정만 export할 수 있지만, 멀티 entry IIFE는
// 각 entry를 별도 빌드로 처리하는 것이 필요합니다.
// 여기서는 content를 메인으로 하고, entry-bridge는 별도 플러그인으로 처리합니다.
export default defineConfig({
  plugins: [
    react(),
    // entry-bridge를 별도 IIFE 번들로 빌드하는 플러그인
    {
      name: 'build-entry-bridge',
      closeBundle: async () => {
        await build({
          configFile: false,
          plugins: [react()],
          resolve: { alias },
          define: commonDefine,
          build: {
            outDir: path.resolve(__dirname, 'dist'),
            emptyOutDir: false,
            lib: {
              entry: path.resolve(__dirname, 'src/content/entry-bridge.ts'),
              name: 'EntryBridge',
              formats: ['iife'],
              fileName: () => 'entry-bridge.js',
            },
            rollupOptions: {
              output: {
                inlineDynamicImports: true,
              },
            },
          },
        });
      },
    },
  ],
  resolve: { alias },
  define: commonDefine,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: path.resolve(__dirname, 'src/content/index.tsx'),
      name: 'ContentScript',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});

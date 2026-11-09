import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { coverageConfigDefaults } from 'vitest/config';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd());
  const syntheticPreview = mode === 'synthetic-preview';

  return {
    base: command === 'build' ? env.VITE_BASE_PATH : '/',
    envPrefix: syntheticPreview ? ['VITE_BASE_PATH', 'VITE_STORAGE_ENGINE'] : 'VITE_',
    plugins: [
      react({ devTarget: 'es2022' }),
      ...(syntheticPreview ? [{
        name: 'synthetic-preview-warning',
        transformIndexHtml(html: string) {
          return html.replace('<div id="root"></div>', '<aside role="alert" style="position:sticky;top:0;z-index:2147483647;padding:12px 16px;background:#8b0000;color:#fff;font:700 16px/1.4 sans-serif;text-align:center">SYNTHETIC PREVIEW — NO PARTICIPANT DATA. Do not use this site for real participants or enter personal information. Data stays only in this browser.</aside><div id="root"></div>');
        },
      }] : []),
    ],
    resolve: {
      alias: {
        // /esm/icons/index.mjs only exports the icons statically, so no separate chunks are created
        '@tabler/icons-react': '@tabler/icons-react/dist/esm/icons/index.mjs',
        // UpSet treats this peer as optional, but Vite still resolves its dynamic import during pre-bundling.
        '@trrack/vis-react': fileURLToPath(new URL('./src/shims/trrackVisReact.ts', import.meta.url)),
      },
    },
    test: {
      environment: 'jsdom',
      exclude: [
        './tests/**',
        'node_modules/**',
        'scripts/check-cedar-watch-source.test.mjs',
        'scripts/prepare-pages-study-entry.test.mjs',
        'scripts/tests/convert-cedar-watch-preview*.test.mjs',
      ],
      setupFiles: ['vitest-localstorage-mock'],
      fileParallelism: true,
      maxWorkers: '100%',
      minWorkers: 1,
      coverage: {
        provider: 'v8',
        all: true,
        exclude: [
          ...coverageConfigDefaults.exclude,
          'public/**',
          'src/public/**',
          'dist/**',
          'eslint.config.js',
          'vite.config.ts',
          'playwright.config.ts',
          'src/vite-env.d.ts',
          'src/lodash.d.ts',
          'src/main.tsx',
          'src/analysis/types.ts',
          'tests/checkSavedAnswers.ts',
          'tests/utils.ts',
        ],
      },
    },
  };
});

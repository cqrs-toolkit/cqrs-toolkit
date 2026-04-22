/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    name: 'unit-client-solid',
    environment: 'jsdom',
    setupFiles: ['src/vitest-setup.ts'],
    includeSource: ['src/*.test.ts', 'src/**/*.test.ts'],
  },
  resolve: {
    // SolidJS uses conditional exports: node → server (no reactivity),
    // browser.development → dev build (needs devtools context).
    // Vitest injects 'development' into resolve conditions, pulling in dev
    // builds that fail without devtools. Alias to browser production builds.
    // Order matters: sub-paths before the base path to avoid prefix shadowing.
    alias: {
      'solid-js/store': 'solid-js/store/dist/store.js',
      'solid-js/web': 'solid-js/web/dist/web.js',
      'solid-js': 'solid-js/dist/solid.js',
    },
  },
})

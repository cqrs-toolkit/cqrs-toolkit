/**
 * Bundle Electron entry points with esbuild.
 *
 * - main.js and worker.js: ESM bundles for Node.js (Electron main + utility process)
 * - preload.mjs: ESM bundle (.mjs required by Electron's sandboxed preload)
 *
 * Bundling is necessary because hypermedia-base exports raw .ts files
 * (consumed by Vite/tsc in the web demo) which Node.js can't import directly.
 * esbuild resolves and compiles all TypeScript imports into plain JS bundles.
 */

import { build } from 'esbuild'

const shared = {
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outdir: 'dist',
  external: ['electron', 'better-sqlite3'],
  sourcemap: true,
  logLevel: 'info',
}

// Main process + utility process worker
await build({
  ...shared,
  entryPoints: ['src/main.ts', 'src/worker.ts'],
})

// Preload — sandboxed preloads run as plain JS without ESM context,
// so this must be a single bundled CJS file.
await build({
  ...shared,
  entryPoints: ['src/preload.ts'],
  format: 'cjs',
})

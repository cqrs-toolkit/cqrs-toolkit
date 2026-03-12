/// <reference types="vitest" />
import { build as esbuild } from 'esbuild'
import { copyFileSync, cpSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import solidPlugin from 'vite-plugin-solid'

const root = resolve(import.meta.dirname)

function extensionBuildPlugin(): Plugin {
  return {
    name: 'extension-build',
    async writeBundle() {
      const dist = resolve(root, 'dist')

      // IIFE targets (no module system)
      const iifeEntries = [
        { in: resolve(root, 'src/hook/hook.ts'), out: 'hook' },
        { in: resolve(root, 'src/content-script/content-script.ts'), out: 'content-script' },
        { in: resolve(root, 'src/devtools/devtools.ts'), out: 'devtools' },
      ]

      await esbuild({
        entryPoints: iifeEntries.map((e) => ({ in: e.in, out: e.out })),
        bundle: true,
        format: 'iife',
        outdir: dist,
        target: 'chrome120',
      })

      // ESM target for service worker
      await esbuild({
        entryPoints: [{ in: resolve(root, 'src/background/background.ts'), out: 'background' }],
        bundle: true,
        format: 'esm',
        outdir: dist,
        target: 'chrome120',
      })

      // Copy static files
      copyFileSync(resolve(root, 'manifest.json'), resolve(dist, 'manifest.json'))
      copyFileSync(resolve(root, 'devtools.html'), resolve(dist, 'devtools.html'))
      copyFileSync(resolve(root, 'panel.html'), resolve(dist, 'panel.html'))

      const iconsDir = resolve(root, 'icons')
      if (existsSync(iconsDir)) {
        cpSync(iconsDir, resolve(dist, 'icons'), { recursive: true })
      }
    },
  }
}

export default defineConfig({
  root,
  plugins: [solidPlugin(), extensionBuildPlugin()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(root, 'src/panel/index.tsx'),
      output: {
        entryFileNames: 'panel.js',
        assetFileNames: 'panel.[ext]',
      },
    },
  },
  test: {
    name: 'unit-devtools',
    environment: 'node',
    includeSource: ['src/*.test.ts', 'src/**/*.test.ts'],
  },
})

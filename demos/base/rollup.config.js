import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import babel from '@rollup/plugin-babel'
import { nodeResolve } from '@rollup/plugin-node-resolve'

const here = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(resolve(here, 'package.json'), 'utf8'))

export default {
  input: collectInputs(pkg.exports),
  external: (id) => !id.startsWith('.') && !id.startsWith('/'),
  output: {
    dir: 'dist',
    format: 'esm',
    preserveModules: true,
    preserveModulesRoot: '.',
    entryFileNames: '[name].js',
  },
  plugins: [
    nodeResolve({ extensions: ['.ts', '.tsx'] }),
    babel({
      extensions: ['.ts', '.tsx'],
      babelHelpers: 'bundled',
      presets: [
        ['babel-preset-solid', { generate: 'dom' }],
        ['@babel/preset-typescript', { allExtensions: true, isTSX: true }],
      ],
    }),
  ],
}

function collectInputs(exports) {
  const inputs = new Set()
  for (const entry of Object.values(exports)) {
    const importPath = entry?.import
    if (typeof importPath !== 'string') continue
    inputs.add(importPath.replace(/^\.\/dist\//, '').replace(/\.js$/, '.ts'))
  }
  return [...inputs]
}

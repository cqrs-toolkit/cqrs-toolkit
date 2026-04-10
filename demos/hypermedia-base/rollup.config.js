import babel from '@rollup/plugin-babel'
import json from '@rollup/plugin-json'
import { nodeResolve } from '@rollup/plugin-node-resolve'

export default {
  input: [
    'src/index.ts',
    'src/bootstrap/cqrs-config.ts',
    'src/bootstrap/typed-client.ts',
    'src/pages/index.ts',
    'src/components/PageShell.tsx',
    'src/primitives/createEditNavigator.ts',
    'src/e2e-helpers.ts',
    'src/e2e-nav.ts',
  ],
  external: (id) => !id.startsWith('.') && !id.startsWith('/'),
  output: {
    dir: 'dist',
    format: 'esm',
    preserveModules: true,
    preserveModulesRoot: '.',
    entryFileNames: '[name].js',
  },
  plugins: [
    json(),
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

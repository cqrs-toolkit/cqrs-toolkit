import babel from '@rollup/plugin-babel'
import { nodeResolve } from '@rollup/plugin-node-resolve'

export default {
  input: 'src/index.ts',
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

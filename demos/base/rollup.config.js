import babel from '@rollup/plugin-babel'
import { nodeResolve } from '@rollup/plugin-node-resolve'

export default {
  input: [
    'src/index.ts',
    'src/commands/components/index.ts',
    'src/common/components/index.ts',
    'src/common/server/index.ts',
    'src/common/shared/index.ts',
    'src/file-objects/components/index.ts',
    'src/file-objects/domain/index.ts',
    'src/file-objects/server/index.ts',
    'src/file-objects/shared/index.ts',
    'src/notebooks/components/index.ts',
    'src/notebooks/domain/index.ts',
    'src/notebooks/server/index.ts',
    'src/notebooks/shared/index.ts',
    'src/notes/components/index.ts',
    'src/notes/domain/index.ts',
    'src/notes/server/index.ts',
    'src/notes/shared/index.ts',
    'src/todos/components/index.ts',
    'src/todos/domain/index.ts',
    'src/todos/server/index.ts',
    'src/todos/shared/index.ts',
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

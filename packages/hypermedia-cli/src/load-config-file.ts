/**
 * Config file loader — handles both plain JS and TypeScript config files.
 *
 * For `.ts` files, uses esbuild to bundle local TS imports into a temp `.mjs`
 * file while keeping node_modules external for native Node resolution.
 */

import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

async function getEsbuild() {
  try {
    return (await import('esbuild')).default
  } catch {
    throw new Error(
      'esbuild is required to load TypeScript config files.\n' +
        'Install it with: npm add -D esbuild',
    )
  }
}

/**
 * Load a config file and return its default export.
 * JS/MJS files are imported natively. TS files are bundled via esbuild first.
 */
export async function loadConfigFile<T>(configPath: string): Promise<T> {
  const ext = extname(configPath)

  if (ext === '.js' || ext === '.mjs') {
    const mod = (await import(pathToFileURL(configPath).href)) as { default: T }
    return mod.default
  }

  const esbuild = await getEsbuild()
  const configDir = dirname(configPath)
  const tsconfigPath = findTsconfig(configDir)
  // Write temp file next to the config so Node's module resolution
  // finds the project's node_modules (resolving from /tmp/ would fail).
  const tmpFile = join(configDir, `.cqrs-toolkit-${randomUUID()}.mjs`)

  try {
    const result = await esbuild.build({
      entryPoints: [configPath],
      outfile: tmpFile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node18',
      conditions: ['import', 'node'],
      mainFields: ['module', 'main'],
      tsconfig: tsconfigPath,
      sourcemap: 'inline',
      logLevel: 'silent',
    })

    if (result.errors.length > 0) {
      const messages = await esbuild.formatMessages(result.errors, { kind: 'error' })
      throw new Error(`Config bundle failed:\n${messages.join('\n')}`)
    }

    if (result.warnings.length > 0) {
      const messages = await esbuild.formatMessages(result.warnings, { kind: 'warning' })
      process.stderr.write(messages.join('\n'))
    }

    const mod = (await import(pathToFileURL(tmpFile).href)) as { default?: T }

    if (mod.default === undefined || mod.default === null) {
      throw new Error(`Config file "${configPath}" did not export a default value.`)
    }

    return mod.default
  } catch (err) {
    if (err instanceof Error && !err.message.includes(configPath)) {
      err.message = `Failed to load config from "${configPath}": ${err.message}`
    }
    throw err
  } finally {
    await rm(tmpFile, { force: true })
  }
}

/** Walk up from configDir looking for a tsconfig.json. */
function findTsconfig(startDir: string): string | undefined {
  let dir = startDir
  while (true) {
    const candidate = resolve(dir, 'tsconfig.json')
    if (existsSync(candidate)) return candidate
    const parent = dirname(dir)
    if (parent === dir) return undefined
    dir = parent
  }
}

/**
 * CLI config file discovery and loading.
 */

import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { PullConfig } from '../config.js'

const CONFIG_FILENAMES = [
  'cqrs-hypermedia.config.ts',
  'cqrs-hypermedia.config.js',
  'cqrs-hypermedia.config.mjs',
]

interface ResolvedConfig extends PullConfig {
  /** Resolved absolute path to the output directory */
  resolvedOutputDir: string
}

/**
 * Load the pull config from the project root.
 * Searches for known config filenames in order.
 * TS configs require a TypeScript-capable loader (e.g. tsx via NODE_OPTIONS).
 */
export async function loadConfig(projectRoot: string): Promise<ResolvedConfig> {
  const configPath = findConfigFile(projectRoot)
  const mod = (await import(pathToFileURL(configPath).href)) as { default: PullConfig }
  const config = mod.default
  validateConfig(config, configPath)
  return {
    ...config,
    resolvedOutputDir: resolve(projectRoot, config.outputDir ?? '.cqrs'),
  }
}

function findConfigFile(projectRoot: string): string {
  for (const name of CONFIG_FILENAMES) {
    const candidate = join(projectRoot, name)
    if (existsSync(candidate)) return candidate
  }
  throw new Error(`No config file found. Create one of: ${CONFIG_FILENAMES.join(', ')}`)
}

function validateConfig(config: unknown, path: string): asserts config is PullConfig {
  if (typeof config !== 'object' || config === null) {
    throw new Error(`Config file ${path} must default-export an object`)
  }
  const c = config as Record<string, unknown>
  if (typeof c['server'] !== 'string') {
    throw new Error(`Config 'server' must be a string`)
  }
  if (typeof c['apidocPath'] !== 'string') {
    throw new Error(`Config 'apidocPath' must be a string`)
  }
  if (!Array.isArray(c['commands']) || c['commands'].length === 0) {
    throw new Error(`Config 'commands' must be a non-empty array of URN strings`)
  }
  if (!Array.isArray(c['representations'])) {
    throw new Error(`Config 'representations' must be an array of @id fragment strings`)
  }
}

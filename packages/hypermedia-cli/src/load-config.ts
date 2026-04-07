import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { ToolkitConfig } from './config.js'
import { loadConfigFile } from './load-config-file.js'

const CONFIG_FILENAMES = [
  'cqrs-toolkit.config.ts',
  'cqrs-toolkit.config.js',
  'cqrs-toolkit.config.mjs',
]

export async function loadToolkitConfig(projectRoot: string): Promise<ToolkitConfig> {
  const configPath = findConfigFile(projectRoot)
  return loadConfigFile<ToolkitConfig>(configPath)
}

function findConfigFile(projectRoot: string): string {
  for (const name of CONFIG_FILENAMES) {
    const candidate = join(projectRoot, name)
    if (existsSync(candidate)) return candidate
  }
  throw new Error(`No config file found. Create one of: ${CONFIG_FILENAMES.join(', ')}`)
}

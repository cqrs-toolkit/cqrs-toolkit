/**
 * Config validation and resolution for `cqrs-toolkit client` commands.
 */

import { isAbsolute } from 'node:path'
import type { PullConfig } from '../config.js'

/**
 * Validate a raw PullConfig.
 * Throws on invalid config.
 */
export function resolveConfig(rawConfig: PullConfig): PullConfig {
  validateConfig(rawConfig)
  return rawConfig
}

function validateConfig(config: unknown): asserts config is PullConfig {
  if (typeof config !== 'object' || config === null) {
    throw new Error(`Client config must be an object`)
  }
  const c = config as Record<string, unknown>
  if (typeof c['server'] !== 'string') {
    throw new Error(`Config 'client.server' must be a string`)
  }
  if (typeof c['apidocPath'] !== 'string') {
    throw new Error(`Config 'client.apidocPath' must be a string`)
  }
  if (!Array.isArray(c['commands']) || c['commands'].length === 0) {
    throw new Error(`Config 'client.commands' must be a non-empty array of URN strings`)
  }
  if (!Array.isArray(c['representations'])) {
    throw new Error(`Config 'client.representations' must be an array of @id fragment strings`)
  }
  if (typeof c['outputDir'] !== 'string') {
    throw new Error(`Config 'client.outputDir' must be a string`)
  }
  if (!isAbsolute(c['outputDir'])) {
    throw new Error(
      `Config 'client.outputDir' must be an absolute path. Use path.resolve(__dirname, '...') in your config.`,
    )
  }
}

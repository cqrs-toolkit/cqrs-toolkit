/**
 * Config validation and resolution for `cqrs-toolkit client` commands.
 */

import { resolve } from 'node:path'
import type { PullConfig } from '../config.js'

export interface ResolvedPullConfig extends PullConfig {
  /** Resolved absolute path to the output directory */
  resolvedOutputDir: string
}

/**
 * Validate and resolve a raw PullConfig into a ResolvedPullConfig.
 * Throws on invalid config.
 */
export function resolveConfig(rawConfig: PullConfig, projectRoot: string): ResolvedPullConfig {
  validateConfig(rawConfig)
  return {
    ...rawConfig,
    resolvedOutputDir: resolve(projectRoot, rawConfig.outputDir ?? '.cqrs'),
  }
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
}

import type { PullConfig } from '@cqrs-toolkit/hypermedia-client/config'
import type { HydraConfig } from '@cqrs-toolkit/hypermedia/config'

export interface ToolkitConfig {
  server?: HydraConfig
  client?: PullConfig
}

/**
 * Identity helper for type-safe config files.
 *
 * ```ts
 * // cqrs-toolkit.config.ts
 * import { defineConfig } from '@cqrs-toolkit/hypermedia-cli/config'
 *
 * export default defineConfig({
 *   server: { classes: [...], prefixes: [...], ... },
 *   client: { server: '...', commands: [...], ... },
 * })
 * ```
 */
export function defineConfig(config: ToolkitConfig): ToolkitConfig {
  return config
}

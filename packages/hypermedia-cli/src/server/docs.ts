import { loadToolkitConfig } from '#load-config'
import type { CommandOptions } from '@cqrs-toolkit/hypermedia/builder'

export async function run(projectRoot: string, opts: CommandOptions): Promise<void> {
  const config = await loadToolkitConfig(projectRoot)
  if (!config.server || typeof config.server !== 'object') {
    throw new Error(
      `Config is missing 'server' section. Add server: { ... } to cqrs-toolkit.config.ts`,
    )
  }
  const { resolveConfig, docs } = await import('@cqrs-toolkit/hypermedia/builder')
  const resolved = resolveConfig(config.server, projectRoot, opts)
  await docs(resolved)
}

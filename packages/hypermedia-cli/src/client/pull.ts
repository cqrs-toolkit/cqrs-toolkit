import { loadToolkitConfig } from '#load-config'

export async function run(projectRoot: string): Promise<void> {
  const config = await loadToolkitConfig(projectRoot)
  if (!config.client || typeof config.client !== 'object') {
    throw new Error(
      `Config is missing 'client' section. Add client: { ... } to cqrs-toolkit.config.ts`,
    )
  }
  const { resolveConfig, pull } = await import('@cqrs-toolkit/hypermedia-client/internals')
  const resolved = resolveConfig(config.client, projectRoot)
  await pull(resolved)
}

import type { InitOptions } from '@cqrs-toolkit/hypermedia-client/internals'

export async function run(projectRoot: string, opts: InitOptions): Promise<void> {
  const { init } = await import('@cqrs-toolkit/hypermedia-client/internals')
  await init(projectRoot, opts)
}

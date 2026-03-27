import {
  deriveEntityKey,
  type CacheKeyIdentity,
  type Collection,
  type SeedOnDemandConfig,
} from '@cqrs-toolkit/client'
import type { ServiceLink } from '@meticoeus/ddd-es'

export const cacheKeysFromTopics: Collection<ServiceLink>['cacheKeysFromTopics'] = (topics) => {
  const seen = new Set<string>()
  const keys: CacheKeyIdentity<ServiceLink>[] = []
  for (const topic of topics) {
    if (topic.startsWith('Notebook:')) {
      const id = topic.slice('Notebook:'.length)
      if (!id) continue
      if (seen.has(id)) continue

      seen.add(id)
      keys.push(deriveEntityKey<ServiceLink>({ service: 'nb', type: 'Notebook', id }))
    }
  }
  return keys
}

export const subscribeTopics: SeedOnDemandConfig<ServiceLink>['subscribeTopics'] = (
  cacheKey,
): string[] => {
  switch (cacheKey.kind) {
    case 'entity':
      if (cacheKey.link.type === 'Notebook') {
        return [`Notebook:${cacheKey.link.id}`]
      }
      break
  }
  return []
}

import { type Collection } from '@cqrs-toolkit/client'
import { TodoAggregate } from '@cqrs-toolkit/client/testing'
import { type ServiceLink } from '@meticoeus/ddd-es'

export function todosCollection(): Collection<ServiceLink> {
  return {
    name: 'todos',
    aggregate: TodoAggregate,
    matchesStream: (streamId) => streamId.startsWith('nb.Todo-'),
    cacheKeysFromTopics: () => [],
  }
}

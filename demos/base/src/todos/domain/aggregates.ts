import { ClientAggregate, EntityId, entityIdToString } from '@cqrs-toolkit/client'
import { ServiceLink } from '@meticoeus/ddd-es'

export const TodoAggregate = new ClientAggregate<ServiceLink>({
  service: 'nb',
  type: 'Todo',
  getStreamId(id: EntityId): string {
    return `nb.Todo-${entityIdToString(id)}`
  },
})

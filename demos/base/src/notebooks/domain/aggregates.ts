import { ClientAggregate, EntityId, entityIdToString } from '@cqrs-toolkit/client'
import { ServiceLink } from '@meticoeus/ddd-es'

export const NotebookAggregate = new ClientAggregate<ServiceLink>({
  service: 'nb',
  type: 'Notebook',
  getStreamId(id: EntityId): string {
    return `nb.Notebook-${entityIdToString(id)}`
  },
})

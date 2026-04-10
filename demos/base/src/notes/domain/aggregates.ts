import { ClientAggregate, EntityId, entityIdToString } from '@cqrs-toolkit/client'
import { ServiceLink } from '@meticoeus/ddd-es'

export const NoteAggregate = new ClientAggregate<ServiceLink>({
  service: 'nb',
  type: 'Note',
  getStreamId(id: EntityId): string {
    return `nb.Note-${entityIdToString(id)}`
  },
})

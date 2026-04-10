import { ClientAggregate, EntityId, entityIdToString } from '@cqrs-toolkit/client'
import { ServiceLink } from '@meticoeus/ddd-es'

export const FileObjectAggregate = new ClientAggregate<ServiceLink>({
  service: 'storage',
  type: 'FileObject',
  getStreamId(id: EntityId): string {
    return `storage.FileObject-${entityIdToString(id)}`
  },
})

import { Err, Ok, Result, ServiceLink } from '@meticoeus/ddd-es'
import { ClientAggregate, StreamIdParseException } from '../types/aggregates.js'

export function parseTestStreamId(streamId: string): Result<ServiceLink, StreamIdParseException> {
  // Format: `{service}.{Type}-{id}` where id may itself contain hyphens (e.g., UUIDs).
  const dotIndex = streamId.indexOf('.')
  if (dotIndex < 0) return Err(new StreamIdParseException(streamId))
  const service = streamId.slice(0, dotIndex)
  const rest = streamId.slice(dotIndex + 1)
  const dashIndex = rest.indexOf('-')
  if (dashIndex < 0) return Err(new StreamIdParseException(streamId))
  const type = rest.slice(0, dashIndex)
  const id = rest.slice(dashIndex + 1)
  if (service.length === 0 || type.length === 0 || id.length === 0) {
    return Err(new StreamIdParseException(streamId))
  }
  return Ok({ service, type, id } as ServiceLink)
}

export const NotebookAggregate = new ClientAggregate<ServiceLink>({
  service: 'nb',
  type: 'Notebook',
  getStreamId: (id) => `nb.Notebook-${id}`,
})

export const NoteAggregate = new ClientAggregate<ServiceLink>({
  service: 'nb',
  type: 'Note',
  getStreamId: (id) => `nb.Note-${id}`,
})

export const TodoAggregate = new ClientAggregate<ServiceLink>({
  service: 'nb',
  type: 'Todo',
  getStreamId: (id) => `nb.Todo-${id}`,
})

export const ItemAggregate = new ClientAggregate<ServiceLink>({
  service: 'nb',
  type: 'Item',
  getStreamId: (id) => `nb.Item-${id}`,
})

export const FolderAggregate = new ClientAggregate<ServiceLink>({
  service: 'nb',
  type: 'Folder',
  getStreamId: (id) => `nb.Folder-${id}`,
})

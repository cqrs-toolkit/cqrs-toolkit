import type { ServiceLink } from '@meticoeus/ddd-es'
import { ClientAggregate } from '../types/aggregates.js'

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

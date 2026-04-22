/**
 * Notebook command handlers — anticipated event production from validated data.
 */

import {
  createEntityId,
  domainSuccess,
  ValidationException,
  type AsyncValidationContext,
} from '@cqrs-toolkit/client'
import type { Notebook } from '@cqrs-toolkit/demo-base/notebooks/domain'
import {
  NOTEBOOK_SEED_KEY,
  NotebookAggregate,
  NOTEBOOKS_COLLECTION_NAME,
} from '@cqrs-toolkit/demo-base/notebooks/domain'
import { Err, Ok, ServiceLink, type Result } from '@meticoeus/ddd-es'
import type { AppCommandHandlerRegistration } from '../utils/executors.js'

async function checkNameUniqueness(
  name: string,
  excludeId: string | undefined,
  { queryManager }: AsyncValidationContext<ServiceLink>,
): Promise<Result<unknown, ValidationException>> {
  const result = await queryManager.list<Notebook>({
    collection: NOTEBOOKS_COLLECTION_NAME,
    cacheKey: NOTEBOOK_SEED_KEY,
  })
  const duplicate = result.data.find(
    (n) => n.name === name && (excludeId === undefined || n.id !== excludeId),
  )
  if (duplicate) {
    return Err(
      new ValidationException([
        {
          path: 'name',
          code: 'duplicate',
          message: 'A notebook with this name already exists',
          params: { name },
        },
      ]),
    )
  }
  return Ok(undefined)
}

export const notebookHandlers: AppCommandHandlerRegistration[] = [
  {
    commandType: 'nb.CreateNotebook',
    aggregate: NotebookAggregate,
    commandIdReferences: [],
    creates: { eventType: 'NotebookCreated', idStrategy: 'temporary' },
    async validateAsync(command, _state, context) {
      const { name } = command.data as { name: string }
      const check = await checkNameUniqueness(name, undefined, context)
      if (!check.ok) return check
      return Ok(command.data)
    },
    handler(command, _state, context) {
      const { name } = command.data as { name: string }
      const id = createEntityId(context)
      const now = new Date().toISOString()
      return domainSuccess([
        {
          type: 'NotebookCreated',
          data: { id, name, createdAt: now },
          streamId: NotebookAggregate.getStreamId(id),
        },
      ])
    },
  },
  {
    commandType: 'nb.UpdateNotebookName',
    aggregate: NotebookAggregate,
    commandIdReferences: [{ aggregate: NotebookAggregate, path: '$.path.id' }],
    async validateAsync(command, _state, context) {
      const { name } = command.data as { name: string }
      // TODO(command-types): Figure out how we can fix this
      const { id } = command.path as { id: string }
      const check = await checkNameUniqueness(name, id, context)
      if (!check.ok) return check
      return Ok(command.data)
    },
    handler(command) {
      const { name } = command.data as { name: string }
      // TODO(command-types): Figure out how we can fix this
      const { id } = command.path as { id: string }
      return domainSuccess([
        {
          type: 'nb.NotebookNameUpdated',
          data: { id, name, updatedAt: new Date().toISOString() },
          streamId: NotebookAggregate.getStreamId(id),
        },
      ])
    },
  },
  {
    commandType: 'nb.DeleteNotebook',
    aggregate: NotebookAggregate,
    commandIdReferences: [{ aggregate: NotebookAggregate, path: '$.path.id' }],
    handler(command) {
      // TODO(command-types): Figure out how we can fix this
      const { id } = command.path as { id: string }
      return domainSuccess([
        { type: 'NotebookDeleted', data: { id }, streamId: NotebookAggregate.getStreamId(id) },
      ])
    },
  },
  {
    commandType: 'nb.AddNotebookTag',
    aggregate: NotebookAggregate,
    commandIdReferences: [{ aggregate: NotebookAggregate, path: '$.path.id' }],
    handler(command) {
      const { tag } = command.data as { tag: string }
      // TODO(command-types): Figure out how we can fix this
      const { id } = command.path as { id: string }
      return domainSuccess([
        {
          type: 'NotebookTagAdded',
          data: { id, tag },
          streamId: NotebookAggregate.getStreamId(id),
        },
      ])
    },
  },
  {
    commandType: 'nb.RemoveNotebookTag',
    aggregate: NotebookAggregate,
    commandIdReferences: [{ aggregate: NotebookAggregate, path: '$.path.id' }],
    handler(command) {
      const { tag } = command.data as { tag: string }
      // TODO(command-types): Figure out how we can fix this
      const { id } = command.path as { id: string }
      return domainSuccess([
        {
          type: 'NotebookTagRemoved',
          data: { id, tag },
          streamId: NotebookAggregate.getStreamId(id),
        },
      ])
    },
  },
]

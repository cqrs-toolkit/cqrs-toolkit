/**
 * Notebook command handlers — anticipated event production from validated data.
 */

import {
  createEntityId,
  deriveScopeKey,
  domainSuccess,
  ValidationException,
  type AsyncValidationContext,
} from '@cqrs-toolkit/client'
import type { Notebook } from '@cqrs-toolkit/demo-base/notebooks/domain'
import { NotebookAggregate } from '@cqrs-toolkit/demo-base/notebooks/domain'
import {
  addNotebookTagPayloadSchema,
  createNotebookPayloadSchema,
  deleteNotebookPayloadSchema,
  removeNotebookTagPayloadSchema,
  updateNotebookNamePayloadSchema,
} from '@cqrs-toolkit/demo-base/notebooks/shared'
import { Err, Ok, ServiceLink, type Result } from '@meticoeus/ddd-es'
import type { AppCommandHandlerRegistration } from '../utils/executors.js'

async function checkNameUniqueness(
  name: string,
  excludeId: string | undefined,
  { queryManager }: AsyncValidationContext<ServiceLink>,
): Promise<Result<unknown, ValidationException>> {
  const result = await queryManager.list<Notebook>({
    collection: 'notebooks',
    cacheKey: deriveScopeKey({ scopeType: 'notebooks' }),
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
    commandType: 'CreateNotebook',
    schema: createNotebookPayloadSchema,
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
    commandType: 'UpdateNotebookName',
    schema: updateNotebookNamePayloadSchema,
    async validateAsync(command, _state, context) {
      const { id, name } = command.data as { id: string; name: string }
      const check = await checkNameUniqueness(name, id, context)
      if (!check.ok) return check
      return Ok(command.data)
    },
    handler(command) {
      const { id, name } = command.data as { id: string; name: string }
      return domainSuccess([
        {
          type: 'NotebookNameUpdated',
          data: { id, name, updatedAt: new Date().toISOString() },
          streamId: NotebookAggregate.getStreamId(id),
        },
      ])
    },
  },
  {
    commandType: 'DeleteNotebook',
    schema: deleteNotebookPayloadSchema,
    handler(command) {
      const { id } = command.data as { id: string }
      return domainSuccess([
        {
          type: 'NotebookDeleted',
          data: { id },
          streamId: NotebookAggregate.getStreamId(id),
        },
      ])
    },
  },
  {
    commandType: 'AddNotebookTag',
    schema: addNotebookTagPayloadSchema,
    handler(command) {
      const { id, tag } = command.data as { id: string; tag: string }
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
    commandType: 'RemoveNotebookTag',
    schema: removeNotebookTagPayloadSchema,
    handler(command) {
      const { id, tag } = command.data as { id: string; tag: string }
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

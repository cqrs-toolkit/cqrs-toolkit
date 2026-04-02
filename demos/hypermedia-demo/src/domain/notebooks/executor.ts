/**
 * Notebook command handlers — anticipated event production from validated data.
 */

import {
  createEntityId,
  domainSuccess,
  ValidationException,
  type AsyncValidationContext,
} from '@cqrs-toolkit/client'
import {
  NOTEBOOK_SEED_KEY,
  NOTEBOOKS_COLLECTION_NAME,
} from '@cqrs-toolkit/demo-base/notebooks/domain'
import type { Notebook } from '@cqrs-toolkit/demo-base/notebooks/shared'
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
    creates: { eventType: 'NotebookCreated', idStrategy: 'temporary' },
    async validateAsync(command, context) {
      const { name } = command.data as { name: string }
      const check = await checkNameUniqueness(name, undefined, context)
      if (!check.ok) return check
      return Ok(command.data)
    },
    handler(command, context) {
      const { name } = command.data as { name: string }
      const id = createEntityId(context)
      const now = new Date().toISOString()
      return domainSuccess([
        {
          type: 'NotebookCreated',
          data: { id, name, createdAt: now },
          streamId: `Notebook-${id}`,
        },
      ])
    },
  },
  {
    commandType: 'nb.UpdateNotebookName',
    async validateAsync(command, context) {
      const { name } = command.data as { name: string }
      const check = await checkNameUniqueness(name, command.path.id, context)
      if (!check.ok) return check
      return Ok(command.data)
    },
    handler(command) {
      const { name } = command.data as { name: string }
      const { id } = command.path
      return domainSuccess([
        {
          type: 'nb.NotebookNameUpdated',
          data: { id, name, updatedAt: new Date().toISOString() },
          streamId: `Notebook-${id}`,
        },
      ])
    },
  },
  {
    commandType: 'nb.DeleteNotebook',
    handler(command) {
      const { id } = command.path
      return domainSuccess([{ type: 'NotebookDeleted', data: { id }, streamId: `Notebook-${id}` }])
    },
  },
  {
    commandType: 'nb.AddNotebookTag',
    handler(command) {
      const { tag } = command.data as { tag: string }
      const { id } = command.path
      return domainSuccess([
        {
          type: 'NotebookTagAdded',
          data: { id, tag },
          streamId: `Notebook-${id}`,
        },
      ])
    },
  },
  {
    commandType: 'nb.RemoveNotebookTag',
    handler(command) {
      const { tag } = command.data as { tag: string }
      const { id } = command.path
      return domainSuccess([
        {
          type: 'NotebookTagRemoved',
          data: { id, tag },
          streamId: `Notebook-${id}`,
        },
      ])
    },
  },
]

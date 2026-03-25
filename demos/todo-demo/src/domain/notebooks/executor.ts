/**
 * Notebook command handlers — anticipated event production from validated data.
 */

import {
  createEntityId,
  domainSuccess,
  type AsyncValidationContext,
  type HandlerContext,
  type ValidationError,
} from '@cqrs-toolkit/client'
import {
  createNotebookPayloadSchema,
  deleteNotebookPayloadSchema,
  updateNotebookNamePayloadSchema,
  type Notebook,
} from '@cqrs-toolkit/demo-base/notebooks/shared'
import { Err, Ok, ServiceLink, ValidationException, type Result } from '@meticoeus/ddd-es'
import type { AppCommandHandlerRegistration } from '../utils/executors.js'

async function checkNameUniqueness(
  name: string,
  excludeId: string | undefined,
  { queryManager }: AsyncValidationContext<ServiceLink>,
): Promise<Result<unknown, ValidationException<ValidationError[]>>> {
  const result = await queryManager.list<Notebook>('notebooks')
  const duplicate = result.data.find(
    (n) => n.name === name && (excludeId === undefined || n.id !== excludeId),
  )
  if (duplicate) {
    return Err(
      new ValidationException(undefined, [
        { path: 'name', message: 'A notebook with this name already exists' },
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
    async validateAsync(data: { name: string }, context: AsyncValidationContext<ServiceLink>) {
      const check = await checkNameUniqueness(data.name, undefined, context)
      if (!check.ok) return check
      return Ok(data)
    },
    handler(data: { name: string }, context: HandlerContext) {
      const id = createEntityId(context)
      const now = new Date().toISOString()
      return domainSuccess([
        {
          type: 'NotebookCreated',
          data: { id, name: data.name, createdAt: now },
          streamId: `Notebook-${id}`,
        },
      ])
    },
  },
  {
    commandType: 'UpdateNotebookName',
    schema: updateNotebookNamePayloadSchema,
    async validateAsync(
      data: { id: string; name: string },
      context: AsyncValidationContext<ServiceLink>,
    ) {
      const check = await checkNameUniqueness(data.name, data.id, context)
      if (!check.ok) return check
      return Ok(data)
    },
    handler(data: { id: string; name: string }) {
      return domainSuccess([
        {
          type: 'NotebookNameUpdated',
          data: { id: data.id, name: data.name, updatedAt: new Date().toISOString() },
          streamId: `Notebook-${data.id}`,
        },
      ])
    },
  },
  {
    commandType: 'DeleteNotebook',
    schema: deleteNotebookPayloadSchema,
    handler(data: { id: string }) {
      return domainSuccess([
        { type: 'NotebookDeleted', data: { id: data.id }, streamId: `Notebook-${data.id}` },
      ])
    },
  },
]

/**
 * Shared CQRS configuration.
 *
 * Imported by both the main thread (cqrs-client.ts) and worker entry points
 * (workers/dedicated-worker.ts, workers/shared-worker.ts). Each context runs
 * this module independently — no serialization needed.
 */

import {
  clientSchema,
  cookieAuthStrategy,
  type CqrsConfig,
  type IAnticipatedEvent,
} from '@cqrs-toolkit/client'
import {
  createAjvSchemaValidator,
  createHypermediaCommandSender,
  withSchemaRegistry,
} from '@cqrs-toolkit/hypermedia-client'
import type { ServiceLink } from '@meticoeus/ddd-es'
import type { JSONSchema7 } from 'json-schema'
import { commands } from '../.cqrs/commands.js'
import { schemas } from '../.cqrs/schemas.js'
import { notebooksCollection } from '../domain/notebooks/collection.js'
import { notebookHandlers } from '../domain/notebooks/executor.js'
import { notebookProcessors } from '../domain/notebooks/processor.js'
import { notesCollection } from '../domain/notes/collection.js'
import { noteHandlers } from '../domain/notes/executor.js'
import { noteProcessors } from '../domain/notes/processor.js'
import { todosCollection } from '../domain/todos/collection.js'
import { todoHandlers } from '../domain/todos/executor.js'
import { todoProcessors } from '../domain/todos/processor.js'

export const cqrsConfig: CqrsConfig<ServiceLink, JSONSchema7, IAnticipatedEvent> = {
  schemaValidator: createAjvSchemaValidator(schemas),
  auth: cookieAuthStrategy,
  network: {
    baseUrl: `${location.origin}/api`,
    wsUrl: `${location.origin.replace(/^http/, 'ws')}/ws`,
  },
  storage: {
    migrations: [
      {
        version: 1,
        message: 'Initial setup',
        steps: [
          clientSchema.init,
          { type: 'managed', name: 'todos' },
          { type: 'managed', name: 'notebooks' },
          { type: 'managed', name: 'notes' },
        ],
      },
    ],
  },
  collections: [todosCollection, notebooksCollection, notesCollection],
  processors: [...todoProcessors, ...notebookProcessors, ...noteProcessors],
  commandHandlers: withSchemaRegistry(schemas, [
    ...todoHandlers,
    ...notebookHandlers,
    ...noteHandlers,
  ]),
  commandSender: createHypermediaCommandSender(commands, {
    baseUrl: location.origin,
  }),
  retainTerminal: true,
  debug: true,
}

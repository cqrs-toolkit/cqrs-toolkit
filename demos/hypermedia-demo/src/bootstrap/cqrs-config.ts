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
import { FILE_OBJECTS_COLLECTION_NAME } from '@cqrs-toolkit/demo-base/file-objects/domain'
import {
  createAjvSchemaValidator,
  createHypermediaCommandSender,
  withSchemaRegistry,
} from '@cqrs-toolkit/hypermedia-client'
import type { ServiceLink } from '@meticoeus/ddd-es'
import type { JSONSchema7 } from 'json-schema'
import { AppCommand, commands } from '../.cqrs/commands.js'
import { schemas } from '../.cqrs/schemas.js'
import { fileObjectsCollection } from '../domain/file-objects/collection.js'
import { handleCreateFileObjectResponse } from '../domain/file-objects/commands.js'
import { fileObjectHandlers } from '../domain/file-objects/executor.js'
import { fileObjectProcessors } from '../domain/file-objects/processor.js'
import { notebooksCollection } from '../domain/notebooks/collection.js'
import { notebookHandlers } from '../domain/notebooks/executor.js'
import { notebookProcessors } from '../domain/notebooks/processor.js'
import { notesCollection } from '../domain/notes/collection.js'
import { noteHandlers } from '../domain/notes/executor.js'
import { noteProcessors } from '../domain/notes/processor.js'
import { todosCollection } from '../domain/todos/collection.js'
import { todoHandlers } from '../domain/todos/executor.js'
import { todoProcessors } from '../domain/todos/processor.js'

export const cqrsConfig: CqrsConfig<ServiceLink, AppCommand, JSONSchema7, IAnticipatedEvent> = {
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
          { type: 'managed', name: FILE_OBJECTS_COLLECTION_NAME },
        ],
      },
    ],
  },
  collections: [todosCollection, notebooksCollection, notesCollection, fileObjectsCollection],
  processors: [
    ...todoProcessors,
    ...notebookProcessors,
    ...noteProcessors,
    ...fileObjectProcessors,
  ],
  commandHandlers: withSchemaRegistry(schemas, [
    ...todoHandlers,
    ...notebookHandlers,
    ...noteHandlers,
    ...fileObjectHandlers,
  ]),
  commandSender: createHypermediaCommandSender<ServiceLink, AppCommand>(commands, {
    baseUrl: location.origin,
    afterSend: {
      'storage.CreateFileObject': handleCreateFileObjectResponse,
    },
  }),
  retainTerminal: true,
  debug: true,
}

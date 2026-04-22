/**
 * Shared CQRS configuration factory.
 *
 * Produces a CqrsConfig from a server base URL. Each platform passes its own
 * origin — web uses `location.origin`, Electron uses a hardcoded localhost URL.
 *
 * Imported by both the main thread (cqrs-client.ts) and worker entry points.
 * Each context runs this module independently — no serialization needed.
 */

import {
  clientSchema,
  cookieAuthStrategy,
  type CqrsConfig,
  type IAnticipatedEvent,
} from '@cqrs-toolkit/client'
import { parseStreamId } from '@cqrs-toolkit/demo-base/common/domain'
import {
  FILE_OBJECTS_COLLECTION_NAME,
  FileObjectAggregate,
} from '@cqrs-toolkit/demo-base/file-objects/domain'
import { NotebookAggregate } from '@cqrs-toolkit/demo-base/notebooks/domain'
import { NoteAggregate } from '@cqrs-toolkit/demo-base/notes/domain'
import { TodoAggregate } from '@cqrs-toolkit/demo-base/todos/domain'
import {
  createAjvSchemaValidator,
  createHypermediaCommandSender,
  withSchemaRegistry,
} from '@cqrs-toolkit/hypermedia-client'
import { ServiceLink } from '@meticoeus/ddd-es'
import type { JSONSchema7 } from 'json-schema'
import { type AppCommand, commands } from '../cqrs/commands.js'
import { schemas } from '../cqrs/schemas.js'
import { fileObjectsCollection } from '../domain/file-objects/collection.js'
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
export type { AppCommand } from '../cqrs/commands.js'

export function createCqrsConfig(
  baseUrl: string,
): CqrsConfig<ServiceLink, AppCommand, JSONSchema7, IAnticipatedEvent> {
  return {
    schemaValidator: createAjvSchemaValidator(schemas),
    auth: cookieAuthStrategy,
    network: {
      baseUrl: `${baseUrl}/api`,
      wsUrl: `${baseUrl.replace(/^http/, 'ws')}/ws`,
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
    aggregates: {
      parseStreamId,
      aggregates: [TodoAggregate, NotebookAggregate, NoteAggregate, FileObjectAggregate],
    },
    collections: [todosCollection, notebooksCollection, notesCollection, fileObjectsCollection],
    processors: [
      ...todoProcessors,
      ...notebookProcessors,
      ...noteProcessors,
      ...fileObjectProcessors,
    ],
    commandHandlers: withSchemaRegistry<ServiceLink, AppCommand, IAnticipatedEvent>(schemas, [
      ...todoHandlers,
      ...notebookHandlers,
      ...noteHandlers,
      ...fileObjectHandlers,
    ]),
    commandSender: createHypermediaCommandSender<ServiceLink, AppCommand>(commands, {
      baseUrl,
    }),
    retainTerminal: true,
    debug: true,
  }
}

/**
 * Shared CQRS configuration.
 *
 * Imported by both the main thread (cqrs-client.ts) and worker entry points
 * (workers/dedicated-worker.ts, workers/shared-worker.ts). Each context runs
 * this module independently — no serialization needed.
 */

import {
  type CqrsConfig,
  EnqueueCommand,
  type IAnticipatedEvent,
  clientSchema,
  cookieAuthStrategy,
} from '@cqrs-toolkit/client'
import { parseStreamId } from '@cqrs-toolkit/demo-base/common/domain'
import { FileObjectAggregate } from '@cqrs-toolkit/demo-base/file-objects/domain'
import { NotebookAggregate } from '@cqrs-toolkit/demo-base/notebooks/domain'
import { NoteAggregate } from '@cqrs-toolkit/demo-base/notes/domain'
import { TodoAggregate } from '@cqrs-toolkit/demo-base/todos/domain'
import { ServiceLink } from '@meticoeus/ddd-es'
import type { JSONSchema7 } from 'json-schema'
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
import { commandSender } from './commands.js'
import { schemaValidator } from './validation.js'

export const cqrsConfig: CqrsConfig<ServiceLink, EnqueueCommand, JSONSchema7, IAnticipatedEvent> = {
  schemaValidator,
  // Cookie-based auth — the browser sends cookies automatically.
  // For token-based auth, override per context with spread-and-override:
  //   startDedicatedWorker({ ...cqrsConfig, auth: workerAuthStrategy })
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
          { type: 'managed', name: todosCollection.name },
          { type: 'managed', name: notebooksCollection.name },
          { type: 'managed', name: notesCollection.name },
          { type: 'managed', name: fileObjectsCollection.name },
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
  commandHandlers: [...todoHandlers, ...notebookHandlers, ...noteHandlers, ...fileObjectHandlers],
  commandSender,
  retainTerminal: true,
  debug: true,
}

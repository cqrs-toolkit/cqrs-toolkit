/**
 * Shared CQRS configuration.
 *
 * Imported by both the main thread (cqrs-client.ts) and worker entry points
 * (workers/dedicated-worker.ts, workers/shared-worker.ts). Each context runs
 * this module independently — no serialization needed.
 */

import { clientSchema, cookieAuthStrategy, type CqrsConfig } from '@cqrs-toolkit/client'
import {
  createAjvSchemaValidator,
  createCollection,
  createHypermediaCommandSender,
  withSchemaRegistry,
} from '@cqrs-toolkit/hypermedia-client'
import type { JSONSchema7 } from 'json-schema'
import { commands } from '../.cqrs/commands.js'
import { representations } from '../.cqrs/representations.js'
import { schemas } from '../.cqrs/schemas.js'
import { notebookHandlers } from '../domain/notebooks/executor.js'
import { notebookProcessors } from '../domain/notebooks/processor.js'
import { noteHandlers } from '../domain/notes/executor.js'
import { noteProcessors } from '../domain/notes/processor.js'
import { todoHandlers } from '../domain/todos/executor.js'
import { todoProcessors } from '../domain/todos/processor.js'

// ---------------------------------------------------------------------------
// Command sender (auto-wired from generated manifest)
// ---------------------------------------------------------------------------

const commandSender = createHypermediaCommandSender(commands, {
  baseUrl: location.origin,
})

// ---------------------------------------------------------------------------
// Collection definitions (wired from generated representation surfaces)
// ---------------------------------------------------------------------------

const todosCollection = createCollection({
  name: 'todos',
  representation: representations['demo:Todo'],
  getTopics: () => ['Todo:*'],
  matchesStream: (streamId) => streamId.startsWith('Todo-'),
})

const notebooksCollection = createCollection({
  name: 'notebooks',
  representation: representations['demo:Notebook'],
  getTopics: () => ['Notebook:*'],
  matchesStream: (streamId) => streamId.startsWith('Notebook-'),
})

const notesCollection = createCollection({
  name: 'notes',
  representation: representations['demo:Note'],
  getTopics: () => ['Notebook:*'],
  matchesStream: (streamId) => streamId.startsWith('Note-'),
})

// ---------------------------------------------------------------------------
// Shared config
// ---------------------------------------------------------------------------

export const cqrsConfig: CqrsConfig<JSONSchema7> = {
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
  commandSender,
  retainTerminal: true,
  debug: true,
}

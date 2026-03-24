/**
 * Shared CQRS configuration.
 *
 * Imported by both the main thread (cqrs-client.ts) and worker entry points
 * (workers/dedicated-worker.ts, workers/shared-worker.ts). Each context runs
 * this module independently — no serialization needed.
 */

import {
  CommandSendError,
  clientSchema,
  cookieAuthStrategy,
  hydrateSerializedEvent,
  type Collection,
  type CqrsConfig,
  type FetchContext,
  type ICommandSender,
  type IPersistedEvent,
  type ISerializedEvent,
  type SchemaValidator,
  type SeedEventPage,
  type ValidationError,
} from '@cqrs-toolkit/client'
import { Err, Ok, ValidationException } from '@meticoeus/ddd-es'
import Ajv, { type ErrorObject } from 'ajv'
import type { JSONSchema7 } from 'json-schema'
import { notebookHandlers } from '../domain/notebooks/executor.js'
import { notebookProcessors } from '../domain/notebooks/processor.js'
import { noteHandlers } from '../domain/notes/executor.js'
import { noteProcessors } from '../domain/notes/processor.js'
import { todoHandlers } from '../domain/todos/executor.js'
import { todoProcessors } from '../domain/todos/processor.js'

// ---------------------------------------------------------------------------
// Schema validation
// ---------------------------------------------------------------------------

const ajv = new Ajv({ allErrors: true })

function mapAjvErrors(errors: ErrorObject[] | null | undefined): ValidationError[] {
  if (!errors) return []
  return errors.map((err) => ({
    path:
      err.instancePath.replace(/^\//, '').replaceAll('/', '.') ||
      String(err.params['missingProperty'] ?? ''),
    message: err.message ?? 'Validation failed',
    code: err.keyword,
  }))
}

const schemaValidator: SchemaValidator<JSONSchema7> = {
  validate(schema, data) {
    const validate = ajv.compile(schema)
    if (validate(data)) {
      return Ok(data)
    }
    return Err(new ValidationException(undefined, mapAjvErrors(validate.errors)))
  },
}

// ---------------------------------------------------------------------------
// Command sender
// ---------------------------------------------------------------------------

const commandEndpoints: Record<string, string> = {
  CreateTodo: '/api/todos/commands',
  UpdateTodoContent: '/api/todos/commands',
  ChangeTodoStatus: '/api/todos/commands',
  DeleteTodo: '/api/todos/commands',
  CreateNote: '/api/notes/commands',
  UpdateNoteTitle: '/api/notes/commands',
  UpdateNoteBody: '/api/notes/commands',
  DeleteNote: '/api/notes/commands',
  CreateNotebook: '/api/notebooks/commands',
  UpdateNotebookName: '/api/notebooks/commands',
  DeleteNotebook: '/api/notebooks/commands',
}

const commandSender: ICommandSender = {
  async send(command) {
    const endpoint = commandEndpoints[command.type]
    if (typeof endpoint !== 'string') {
      throw new CommandSendError(`Unknown command type: ${command.type}`, '400', false)
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-command-id': command.commandId,
      },
      body: JSON.stringify({ type: command.type, data: command.data, revision: command.revision }),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({ message: `Command failed: ${res.status}` }))
      throw new CommandSendError(
        body.message ?? `Command failed: ${res.status}`,
        String(res.status),
        res.status >= 500,
        body.details,
      )
    }

    return res.json()
  },
}

// ---------------------------------------------------------------------------
// Demo-specific HTTP helpers
// ---------------------------------------------------------------------------

/** Type guard for the `{ events: [...], nextCursor?: string }` envelope the demo server returns. */
function isDemoEventResponse(
  data: unknown,
): data is { events: ISerializedEvent[]; nextCursor?: string } {
  if (typeof data !== 'object' || data === null) return false
  const obj = data as Record<string, unknown>
  return Array.isArray(obj['events'])
}

async function fetchEventPage(
  ctx: FetchContext,
  endpoint: string,
  cursor: string | null,
  limit: number,
): Promise<SeedEventPage> {
  const url = new URL(`${ctx.baseUrl}${endpoint}`)
  if (cursor) url.searchParams.set('cursor', cursor)
  url.searchParams.set('limit', String(limit))
  const res = await fetch(url.toString(), { headers: ctx.headers })
  if (!res.ok) throw new Error(`Seed fetch failed: ${res.status}`)
  const data: unknown = await res.json()
  if (!isDemoEventResponse(data)) throw new Error('Expected { events: [...] } response')
  return {
    events: data.events.map(hydrateSerializedEvent),
    nextCursor: data.nextCursor ?? null,
  }
}

async function fetchStreamEventsAfter(
  ctx: FetchContext,
  endpoint: string,
  afterRevision: bigint,
): Promise<IPersistedEvent[]> {
  const url = new URL(`${ctx.baseUrl}${endpoint}`)
  url.searchParams.set('afterRevision', String(afterRevision))
  const res = await fetch(url.toString(), { headers: ctx.headers })
  if (!res.ok) throw new Error(`Stream fetch failed: ${res.status}`)
  const data: unknown = await res.json()
  if (!isDemoEventResponse(data)) throw new Error('Expected { events: [...] } response')
  return data.events.map(hydrateSerializedEvent)
}

/** Extract aggregate ID from "Type-uuid" stream format used by the demo. */
function aggregateId(streamId: string): string {
  return streamId.slice(streamId.indexOf('-') + 1)
}

// ---------------------------------------------------------------------------
// Collection definitions
// ---------------------------------------------------------------------------

const todosCollection: Collection = {
  name: 'todos',
  getTopics: () => ['Todo:*'],
  matchesStream: (streamId) => streamId.startsWith('Todo-'),
  fetchSeedEvents: (ctx, cursor, limit) => fetchEventPage(ctx, '/events/todos', cursor, limit),
  fetchStreamEvents: (ctx, streamId, afterRevision) =>
    fetchStreamEventsAfter(ctx, `/todos/${aggregateId(streamId)}/events`, afterRevision),
}

const notebooksCollection: Collection = {
  name: 'notebooks',
  getTopics: () => ['Notebook:*'],
  matchesStream: (streamId) => streamId.startsWith('Notebook-'),
  fetchSeedEvents: (ctx, cursor, limit) => fetchEventPage(ctx, '/events/notebooks', cursor, limit),
  fetchStreamEvents: (ctx, streamId, afterRevision) =>
    fetchStreamEventsAfter(ctx, `/notebooks/${aggregateId(streamId)}/events`, afterRevision),
}

const notesCollection: Collection = {
  name: 'notes',
  getTopics: () => ['Notebook:*'],
  matchesStream: (streamId) => streamId.startsWith('Note-'),
  fetchSeedEvents: (ctx, cursor, limit) => fetchEventPage(ctx, '/events/notes', cursor, limit),
  fetchStreamEvents: (ctx, streamId, afterRevision) =>
    fetchStreamEventsAfter(ctx, `/notes/${aggregateId(streamId)}/events`, afterRevision),
}

// ---------------------------------------------------------------------------
// Shared config
// ---------------------------------------------------------------------------

export const cqrsConfig: CqrsConfig<JSONSchema7> = {
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
          { type: 'managed', name: 'todos' },
          { type: 'managed', name: 'notebooks' },
          { type: 'managed', name: 'notes' },
        ],
      },
    ],
  },
  collections: [todosCollection, notebooksCollection, notesCollection],
  processors: [...todoProcessors, ...notebookProcessors, ...noteProcessors],
  commandHandlers: [...todoHandlers, ...notebookHandlers, ...noteHandlers],
  commandSender,
  retainTerminal: true,
  debug: true,
}

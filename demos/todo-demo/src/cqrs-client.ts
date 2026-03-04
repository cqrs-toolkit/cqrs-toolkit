import {
  CommandSendError,
  createCqrsClient,
  detectMode,
  hydrateSerializedEvent,
  type Collection,
  type CqrsClient,
  type ExecutionMode,
  type ExecutionModeConfig,
  type FetchContext,
  type ICommandSender,
  type IPersistedEvent,
  type ISerializedEvent,
  type SeedEventPage,
} from '@cqrs-toolkit/client'
import { noteProcessors } from './notes/processor'
import { todoProcessors } from './todos/processor'

const VALID_MODES = new Set<ExecutionModeConfig>([
  'auto',
  'online-only',
  'shared-worker',
  'dedicated-worker',
])

interface EntryOptions {
  mode: ExecutionMode
  /** @default true - enable WebSocket sync */
  ws: boolean
  /** @default true - retain commands */
  cr: boolean
}

export const options: EntryOptions = resolveEntryOptions()

function resolveEntryOptions(): EntryOptions {
  const params = new URLSearchParams(window.location.search)
  return {
    mode: resolveMode(params.get('mode')),
    ws: params.get('ws') !== 'false',
    cr: params.get('cr') !== 'false',
  }
}

function resolveMode(raw: string | null): ExecutionMode {
  const requested: ExecutionModeConfig = VALID_MODES.has(raw as ExecutionModeConfig)
    ? (raw as ExecutionModeConfig)
    : 'auto'

  if (requested === 'auto') {
    return detectMode()
  }

  assertModeSupported(requested)
  return requested
}

/**
 * Assert that the requested mode is supported in the current environment.
 *
 * When a specific mode is requested via `?mode=`, it must be available — silent
 * degradation would produce false-positive test results. The library's own fallback
 * behavior is unaffected because it uses `auto`/`detectMode()`.
 */
function assertModeSupported(requested: ExecutionMode): void {
  switch (requested) {
    case 'shared-worker':
      if (typeof SharedWorker === 'undefined') {
        throw new Error(
          `Requested mode "shared-worker" but SharedWorker is not available in this environment.` +
            ` Use ?mode=auto to let the library pick the best available mode.`,
        )
      }
      return
    case 'dedicated-worker':
      if (typeof Worker === 'undefined') {
        throw new Error(
          `Requested mode "dedicated-worker" but Worker is not available in this environment.` +
            ` Use ?mode=auto to let the library pick the best available mode.`,
        )
      }
      return
    case 'online-only':
      return
  }
}

const commandEndpoints: Record<string, string> = {
  CreateTodo: '/api/todos/commands',
  UpdateTodoContent: '/api/todos/commands',
  ChangeTodoStatus: '/api/todos/commands',
  DeleteTodo: '/api/todos/commands',
  CreateNote: '/api/notes/commands',
  UpdateNoteTitle: '/api/notes/commands',
  UpdateNoteBody: '/api/notes/commands',
  DeleteNote: '/api/notes/commands',
}

const commandSender: ICommandSender = {
  async send(command) {
    const endpoint = commandEndpoints[command.type]
    if (typeof endpoint !== 'string') {
      throw new CommandSendError(`Unknown command type: ${command.type}`, '400', false)
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: command.type, payload: command.payload }),
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
  getTopics: () => (options.ws ? ['Todo:*'] : []),
  matchesStream: (streamId) => streamId.startsWith('Todo-'),
  fetchSeedEvents: (ctx, cursor, limit) => fetchEventPage(ctx, '/events/todos', cursor, limit),
  fetchStreamEvents: (ctx, streamId, afterRevision) =>
    fetchStreamEventsAfter(ctx, `/todos/${aggregateId(streamId)}/events`, afterRevision),
}

const notesCollection: Collection = {
  name: 'notes',
  getTopics: () => (options.ws ? ['Note:*'] : []),
  matchesStream: (streamId) => streamId.startsWith('Note-'),
  fetchSeedEvents: (ctx, cursor, limit) => fetchEventPage(ctx, '/events/notes', cursor, limit),
  fetchStreamEvents: (ctx, streamId, afterRevision) =>
    fetchStreamEventsAfter(ctx, `/notes/${aggregateId(streamId)}/events`, afterRevision),
}

// ---------------------------------------------------------------------------
// Client initialization
// ---------------------------------------------------------------------------

export async function initializeClient(): Promise<CqrsClient> {
  const wsUrl = options.ws ? `${window.location.origin.replace(/^http/, 'ws')}/ws` : undefined

  return createCqrsClient({
    mode: options.mode,
    network: { baseUrl: `${window.location.origin}/api`, wsUrl },
    collections: [todosCollection, notesCollection],
    processors: [...todoProcessors, ...noteProcessors],
    commandSender,
    retainTerminal: options.cr,
  })
}

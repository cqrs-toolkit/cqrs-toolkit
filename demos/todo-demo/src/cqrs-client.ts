import {
  CommandSendError,
  createCqrsClient,
  detectMode,
  type CqrsClient,
  type ExecutionMode,
  type ExecutionModeConfig,
  type ICommandSender,
} from '@cqrs-toolkit/client'
import { noteProcessors } from './notes/processor'
import { todoProcessors } from './todos/processor'

const VALID_MODES = new Set<ExecutionModeConfig>([
  'auto',
  'online-only',
  'shared-worker',
  'dedicated-worker',
  'main-thread',
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
    : 'online-only'

  if (requested === 'auto') {
    return detectMode()
  }

  return degradeMode(requested)
}

/**
 * Degrade a requested mode to the closest supported mode in the current environment.
 *
 * Worker modes degrade downward: shared-worker → dedicated-worker → main-thread.
 * online-only and main-thread are always available and never degrade.
 */
function degradeMode(requested: ExecutionMode): ExecutionMode {
  switch (requested) {
    case 'shared-worker':
      if (typeof SharedWorker !== 'undefined') return 'shared-worker'
      if (typeof Worker !== 'undefined') return 'dedicated-worker'
      return 'main-thread'
    case 'dedicated-worker':
      if (typeof Worker !== 'undefined') return 'dedicated-worker'
      return 'main-thread'
    case 'main-thread':
    case 'online-only':
      return requested
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

export async function initializeClient(): Promise<CqrsClient> {
  const wsUrl = options.ws ? `${window.location.origin.replace(/^http/, 'ws')}/ws` : undefined

  return createCqrsClient({
    mode: options.mode,
    network: { baseUrl: `${window.location.origin}/api`, wsUrl },
    collections: [
      {
        name: 'todos',
        topicPattern: options.ws ? 'Todo:*' : undefined,
        streamEventsEndpoint: '/todos/{id}/events',
      },
      {
        name: 'notes',
        topicPattern: options.ws ? 'Note:*' : undefined,
        streamEventsEndpoint: '/notes/{id}/events',
      },
    ],
    processors: [...todoProcessors, ...noteProcessors],
    commandSender,
    retainTerminal: options.cr,
  })
}

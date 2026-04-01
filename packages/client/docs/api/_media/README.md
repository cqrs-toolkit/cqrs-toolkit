**@cqrs-toolkit/client**

---

# @cqrs-toolkit/client

Offline-capable CQRS/event-sourcing client library for the browser.
Manages command queuing, event caching, read model projection, and sync -- with pluggable execution modes that range from a simple online-only proxy to full offline support via SharedWorker + SQLite.

## Quick Start

```typescript
import {
  createCqrsClient,
  clientSchema,
  cookieAuthStrategy,
  CommandSendException,
  type Collection,
  type CqrsClientConfig,
  type FetchContext,
  type ICommandSender,
  type ProcessorRegistration,
  type SeedEventPage,
} from '@cqrs-toolkit/client'

// 1. Define collections
const todosCollection: Collection = {
  name: 'todos',
  getTopics: () => ['Todo:*'],
  matchesStream: (streamId) => streamId.startsWith('Todo-'),
  fetchSeedEvents: async (ctx, cursor, limit) => {
    const url = new URL(`${ctx.baseUrl}/events/todos`)
    if (cursor) url.searchParams.set('cursor', cursor)
    url.searchParams.set('limit', String(limit))
    const res = await fetch(url, { headers: ctx.headers, signal: ctx.signal })
    return res.json() as Promise<SeedEventPage>
  },
}

// 2. Define event processors
const processors: ProcessorRegistration[] = [
  {
    eventTypes: 'TodoCreated',
    processor: (data, ctx) => ({
      collection: 'todos',
      id: (data as { id: string }).id,
      update: { type: 'set', data: data as Record<string, unknown> },
      isServerUpdate: ctx.persistence !== 'Anticipated',
    }),
  },
]

// 3. Define the command sender
const commandSender: ICommandSender = {
  async send(command) {
    const res = await fetch('/api/todos/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: command.type, payload: command.payload }),
    })
    if (!res.ok) {
      const body = await res.json()
      return Err(new CommandSendException(body.message, String(res.status), res.status >= 500))
    }
    return Ok(await res.json())
  },
}

// 4. Create the client (returns fully initialized)
const client = await createCqrsClient({
  auth: cookieAuthStrategy,
  network: { baseUrl: '/api' },
  storage: {
    migrations: [
      {
        version: 1,
        message: 'Initial schema',
        steps: [clientSchema.init, { type: 'managed', name: 'todos' }],
      },
    ],
  },
  collections: [todosCollection],
  processors,
  commandSender,
})

// 5. Authenticate and start sync
await client.syncManager.setAuthenticated({ userId: 'user-1' })

// 6. Use it
const result = await client.submit({ type: 'CreateTodo', payload: { content: 'Buy milk' } })
const todos = await client.queryManager.list<Todo>('todos')
console.log(todos.data) // Todo[]
```

## Configuration

Configuration is split into two layers:

- [`CqrsConfig`](_media/CqrsConfig.md) -- shared domain config, imported by both the main thread and worker entry points.
  No serialization needed; each context runs the module independently.
- [`CqrsClientConfig`](_media/CqrsClientConfig.md) -- extends `CqrsConfig` with main-thread concerns: `mode`, `workerUrl`, `sqliteWorkerUrl`.

| Field             | Required | Description                                                                  |
| ----------------- | -------- | ---------------------------------------------------------------------------- |
| `auth`            | Yes      | Authentication strategy (`cookieAuthStrategy` or custom)                     |
| `network`         | Yes      | `baseUrl` and optional `wsUrl` for WebSocket                                 |
| `storage`         | Yes      | Schema migrations (must include `clientSchema.init` and managed collections) |
| `collections`     | No       | Collection definitions for event sync and routing                            |
| `processors`      | No       | Event processors that transform events into read model updates               |
| `commandHandlers` | No       | Local validation and optimistic update handlers                              |
| `commandSender`   | No       | HTTP transport for sending commands to the server                            |
| `mode`            | No       | Execution mode (default: `'auto'`)                                           |
| `workerUrl`       | No       | Worker script URL (required for worker modes)                                |
| `sqliteWorkerUrl` | No       | SQLite worker URL (required for shared-worker mode)                          |

## Querying Data

```typescript
// List all items -- returns ListQueryResult<Todo>
const todos = await client.queryManager.list<Todo>('todos')
console.log(todos.data) // Todo[]
console.log(todos.total) // number

// Get a single item -- returns QueryResult<Todo>
const todo = await client.queryManager.getById<Todo>('todos', 'todo-1')
if (todo.data) {
  console.log(todo.data, todo.hasLocalChanges)
}

// Watch a single item (Observable<T | undefined>)
client.queryManager.watchById<Todo>('todos', 'todo-1').subscribe((data) => {
  // Fires on every change
})

// Watch a collection (Observable<string[]> of changed IDs)
client.queryManager.watchCollection('todos').subscribe(async (changedIds) => {
  for (const id of changedIds) {
    const updated = await client.queryManager.getById<Todo>('todos', id)
    // apply granular update to UI
  }
})
```

Additional methods: `getByIds`, `exists`, `count`.
See [`IQueryManager`](_media/IQueryManager.md) for the full interface.

## Sending Commands

`client.submit()` is the primary command API.
It is network-aware: waits for server confirmation when online, returns immediately when offline.

```typescript
const result = await client.submit<CreatePayload, CreateResponse>({
  type: 'CreateTodo',
  payload: { content: 'Buy milk' },
})

if (result.ok) {
  // result.value.stage: 'enqueued' (offline) | 'confirmed' (server acknowledged)
  console.log(result.value.commandId)
  if (result.value.stage === 'confirmed') {
    console.log(result.value.response)
  }
} else {
  // result.error: SubmitException
  console.log(result.error.details?.errors) // ValidationError[]
}
```

For lower-level control, `commandQueue.enqueue()` and `commandQueue.enqueueAndWait()` are also available.
See [`ICommandQueue`](_media/ICommandQueue.md) for the full interface.

## Event Processors

Processors transform domain events into read model updates.
They are passed in config as `processors: ProcessorRegistration[]`.

```typescript
const processors: ProcessorRegistration[] = [
  {
    eventTypes: 'TodoCreated',
    processor: (data, ctx) => ({
      collection: 'todos',
      id: (data as { id: string }).id,
      update: { type: 'set', data: data as Record<string, unknown> },
      isServerUpdate: ctx.persistence !== 'Anticipated',
    }),
  },
  {
    eventTypes: 'TodoDeleted',
    processor: (data) => ({
      collection: 'todos',
      id: (data as { id: string }).id,
      update: { type: 'delete' },
      isServerUpdate: true,
    }),
  },
]
```

Update types:

- `set` -- full replace of the read model data
- `merge` -- partial update (merged with existing data)
- `delete` -- remove the read model entry

`isServerUpdate` distinguishes confirmed server data from optimistic local data.
Use `ctx.persistence !== 'Anticipated'` to mark server-confirmed events.

## Command Handlers

Command handlers enable local validation and optimistic updates via anticipated events.
This is optional -- without handlers, commands are sent directly to the server.

```typescript
import {
  domainSuccess,
  domainFailure,
  generateId,
  type CommandHandlerRegistration,
} from '@cqrs-toolkit/client'

const handlers: CommandHandlerRegistration[] = [
  {
    commandType: 'CreateTodo',
    creates: { eventType: 'TodoCreated', idStrategy: 'temporary' },
    handler(payload) {
      const { content } = payload as { content: string }
      if (!content.trim()) return domainFailure([{ path: 'content', message: 'Required' }])
      const id = generateId()
      return domainSuccess([{ type: 'TodoCreated', streamId: `Todo-${id}`, data: { id, content } }])
    },
  },
]
```

Anticipated events are processed by the same processors, giving instant UI feedback before the server responds.

## Execution Modes

The `mode` option controls where storage and processing happen.
Defaults to `'auto'`, which selects the best mode the browser supports.

| Mode               | Storage       | Multi-tab | Use case                         |
| ------------------ | ------------- | --------- | -------------------------------- |
| `online-only`      | In-memory     | No        | Simple proxy, no offline support |
| `dedicated-worker` | SQLite (OPFS) | No        | Single-tab offline               |
| `shared-worker`    | SQLite (OPFS) | Yes       | Full multi-tab offline           |

Auto-detection order: `shared-worker` > `dedicated-worker` > `online-only`.

### Worker Setup

Worker modes require consumer-owned entry points that import the shared config.
The config is defined once and imported into each context -- no serialization needed.

```typescript
// workers/dedicated-worker.ts
import { startDedicatedWorker } from '@cqrs-toolkit/client'
import { cqrsConfig } from '../bootstrap/cqrs-config'
startDedicatedWorker(cqrsConfig)

// workers/shared-worker.ts
import { startSharedWorker } from '@cqrs-toolkit/client'
import { cqrsConfig } from '../bootstrap/cqrs-config'
startSharedWorker(cqrsConfig)

// workers/sqlite-worker.ts (required for shared-worker mode)
import { startSqliteWorker } from '@cqrs-toolkit/client'
startSqliteWorker()
```

Worker URLs are resolved on the main thread where the bundler can process them:

```typescript
import DedicatedWorkerUrl from './workers/dedicated-worker?worker&url'
import SqliteWorkerUrl from './workers/sqlite-worker?worker&url'

const client = await createCqrsClient({
  ...cqrsConfig,
  mode: 'dedicated-worker',
  workerUrl: DedicatedWorkerUrl,
  sqliteWorkerUrl: SqliteWorkerUrl,
})
```

## Authentication

Cookie-based auth requires no configuration -- the browser sends cookies automatically:

```typescript
import { cookieAuthStrategy } from '@cqrs-toolkit/client'

const config = { auth: cookieAuthStrategy, ... }
```

For token-based auth, implement the [`AuthStrategy`](_media/AuthStrategy.md) interface with hooks for HTTP headers, WebSocket URL preparation, and WebSocket authentication.

After client creation, signal auth state changes to start or stop sync:

```typescript
await client.syncManager.setAuthenticated({ userId: 'user-1' })
// ... later
await client.syncManager.setUnauthenticated()
```

## Lifecycle

```typescript
// Fully initialized on creation
const client = await createCqrsClient(config)

// Start sync after authentication
await client.syncManager.setAuthenticated({ userId: 'user-1' })

// Use the client...

// Shut down (stops sync, releases resources)
await client.close()
```

Runtime properties:

- `client.mode` -- resolved execution mode (`'online-only'`, `'dedicated-worker'`, `'shared-worker'`)
- `client.status` -- adapter status
- `client.events$` -- observable of all library events (sync, command, cache lifecycle)

## API Reference

Full API documentation is generated from source and available at [docs/api](_media/README.md).

Key entry points:

- [`createCqrsClient`](_media/createCqrsClient.md) -- Factory function
- [`CqrsClient`](_media/CqrsClient.md) -- Client class
- [`CqrsClientConfig`](_media/CqrsClientConfig.md) -- Main-thread configuration
- [`CqrsConfig`](_media/CqrsConfig.md) -- Shared configuration
- [`Collection`](_media/Collection.md) -- Collection definition
- [`IQueryManager`](_media/IQueryManager.md) -- Read model queries
- [`ICommandQueue`](_media/ICommandQueue.md) -- Command queuing
- [`ICommandSender`](_media/ICommandSender.md) -- Server transport contract
- [`ProcessorRegistration`](_media/ProcessorRegistration.md) -- Event processor setup
- [`CommandHandlerRegistration`](_media/CommandHandlerRegistration.md) -- Command handler setup
- [`AuthStrategy`](_media/AuthStrategy.md) -- Authentication hooks
- [`CqrsClientSyncManager`](_media/CqrsClientSyncManager.md) -- Sync manager facade
- [`SubmitException`](_media/SubmitException.md) -- Submit error type

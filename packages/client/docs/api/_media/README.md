**@cqrs-toolkit/client**

***

# @cqrs-toolkit/client

Offline-capable CQRS/event-sourcing client library for the browser.

Manages command queuing, event caching, read model projection, and sync — with pluggable execution modes that range from a simple online-only proxy to full offline support via SharedWorker + SQLite.

## Quick Start

```typescript
import { createCqrsClient, CommandSendError, type ICommandSender } from '@cqrs-toolkit/client'

// 1. Define how commands reach your server
const commandSender: ICommandSender = {
  async send(command) {
    const res = await fetch('/api/commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: command.type, payload: command.payload }),
    })
    if (!res.ok) {
      const body = await res.json()
      throw new CommandSendError(body.message, String(res.status), res.status >= 500)
    }
    return res.json()
  },
}

// 2. Create the client
const client = createCqrsClient({
  network: { baseUrl: '/api', wsUrl: 'ws://localhost:3000/events' },
  collections: [{ name: 'todos', seedOnInit: true }],
  commandSender,
})

// 3. Register event processors (before initialize)
client.registerProcessor({
  eventTypes: 'TodoCreated',
  processor: (data, ctx) => ({
    collection: 'todos',
    id: data.id,
    update: { type: 'set', data },
    isServerUpdate: ctx.persistence !== 'Anticipated',
  }),
})

client.registerProcessor({
  eventTypes: 'TodoContentUpdated',
  processor: (data, ctx) => ({
    collection: 'todos',
    id: data.id,
    update: { type: 'merge', data: { content: data.content, updatedAt: data.updatedAt } },
    isServerUpdate: ctx.persistence !== 'Anticipated',
  }),
})

client.registerProcessor({
  eventTypes: 'TodoStatusChanged',
  processor: (data, ctx) => ({
    collection: 'todos',
    id: data.id,
    update: { type: 'merge', data: { status: data.status, updatedAt: data.updatedAt } },
    isServerUpdate: ctx.persistence !== 'Anticipated',
  }),
})

client.registerProcessor({
  eventTypes: 'TodoDeleted',
  processor: (data) => ({
    collection: 'todos',
    id: data.id,
    update: { type: 'delete' },
    isServerUpdate: true,
  }),
})

// 4. Initialize (creates adapter, wires components, starts sync)
await client.initialize()
```

## Querying Data

```typescript
// List all items in a collection
const todos = await client.queryManager.list<Todo>('todos')

// Get a single item by ID
const todo = await client.queryManager.getById<Todo>('todos', 'todo-1')

// Watch a single item for changes
const todo$ = client.queryManager.watchById<Todo>('todos', 'todo-1')

// Watch a collection (emits the specific IDs that changed)
client.queryManager.watchCollection('todos').subscribe(async (changedIds) => {
  for (const id of changedIds) {
    const updated = await client.queryManager.getById<Todo>('todos', id)
    // apply granular update to UI
  }
})
```

## Sending Commands

```typescript
await client.commandQueue.enqueueAndWait({
  type: 'CreateTodo',
  streamId: `todo-${generateId()}`,
  payload: { content: 'Buy milk' },
})
```

## Execution Modes

The `mode` option controls where storage and processing happen.
Defaults to `'auto'`, which selects the best mode the browser supports.

| Mode               | Storage       | Multi-tab | Use case                         |
| ------------------ | ------------- | --------- | -------------------------------- |
| `online-only`      | In-memory     | No        | Simple proxy, no offline support |
| `main-thread`      | SQLite (OPFS) | No        | Single-tab offline               |
| `dedicated-worker` | SQLite (OPFS) | No        | Single-tab, off-main-thread      |
| `shared-worker`    | SQLite (OPFS) | Yes       | Full multi-tab offline           |

Auto-detection order: `shared-worker` > `dedicated-worker` > `main-thread`.

```typescript
const client = createCqrsClient({
  mode: 'shared-worker',
  network: { baseUrl: '/api' },
  workerUrl: '/worker.js',
})
```

## Lifecycle

The client uses a two-step lifecycle: **sync construction**, then **async initialization**.
This allows event processors to be registered before sync begins.

```typescript
const client = createCqrsClient({ ... })

// Register processors (sync, before initialize)
client.registerProcessor({ ... })

// Initialize (async — creates adapter, wires components, starts sync)
await client.initialize()

// Use the client...

// Shut down (stops sync, destroys components, closes adapter)
await client.close()
```

## API Reference

Full API documentation is generated from source and available at [docs/api](_media/README.md).

Key entry points:

- [`createCqrsClient`](_media/createCqrsClient.md) — Factory function
- [`CqrsClient`](_media/CqrsClient.md) — Client class
- [`CqrsClientConfig`](_media/CqrsClientConfig.md) — Configuration options
- [`QueryManager`](_media/QueryManager.md) — Read model queries
- [`CommandQueue`](_media/CommandQueue.md) — Command queuing
- [`ICommandSender`](_media/ICommandSender.md) — Server transport contract
- [`ProcessorRegistration`](_media/ProcessorRegistration.md) — Event processor setup
- [`SyncManager`](_media/SyncManager.md) — Sync lifecycle and status

**@cqrs-toolkit/realtime**

---

# @cqrs-toolkit/realtime

Canonical WebSocket message protocol types and serialization helpers for CQRS real-time event streaming.

Defines a topic-based pub/sub protocol between clients and servers using discriminated unions for type-safe message handling.
Parsing is defensive — malformed input returns `undefined` rather than throwing.

## Install

```bash
npm install @cqrs-toolkit/realtime
```

## Protocol Overview

```
Client → Server         Server → Client
─────────────────       ───────────────────────
subscribe               connected
unsubscribe             subscribed
                        unsubscribed
                        subscription_denied
                        subscription_revoked
                        event
                        heartbeat
```

## Usage

### Client Side

Parse incoming server messages and send subscriptions:

```typescript
import { parseServerMessage, serializeClientMessage } from '@cqrs-toolkit/realtime'

// Parse incoming message
const message = parseServerMessage(wsEvent.data)
if (!message) return // malformed — ignore

switch (message.type) {
  case 'connected':
    // Send subscriptions after connection is established
    ws.send(
      serializeClientMessage({
        type: 'subscribe',
        topics: ['Todo:*', 'Note:*'],
      }),
    )
    break
  case 'event':
    // message.event: ISerializedEvent
    // message.aggregateType: string
    // message.service: string
    // message.topics: string[]
    handleEvent(message)
    break
  case 'heartbeat':
    reportConnectivity()
    break
  case 'subscribed':
  case 'unsubscribed':
    break
  case 'subscription_denied':
  case 'subscription_revoked':
    console.warn(message.message)
    break
}
```

### Server Side

Parse client requests and push events:

```typescript
import {
  parseClientMessage,
  serializeServerMessage,
  type ServerMessage,
} from '@cqrs-toolkit/realtime'

// Acknowledge connection
socket.send(
  serializeServerMessage({
    type: 'connected',
    heartbeatInterval: 30000,
    userId: 'user-1',
    expiresAtMs: null,
  }),
)

// Handle client messages
const msg = parseClientMessage(raw)
if (!msg) return

switch (msg.type) {
  case 'subscribe':
    registerTopics(socket, msg.topics)
    socket.send(serializeServerMessage({ type: 'subscribed', topics: msg.topics }))
    break
  case 'unsubscribe':
    removeTopics(socket, msg.topics)
    socket.send(serializeServerMessage({ type: 'unsubscribed', topics: msg.topics }))
    break
}

// Push an event to matching subscribers
socket.send(
  serializeServerMessage({
    type: 'event',
    topics: ['Todo:abc123'],
    service: 'task-service',
    aggregateType: 'Todo',
    event: serializedEvent,
  }),
)
```

## Message Types

Topic strings are opaque from this package's perspective — the server defines the topic format and matching semantics.

### Server → Client

| Type                   | Key Fields                                    |
| ---------------------- | --------------------------------------------- |
| `connected`            | `heartbeatInterval`, `userId`, `expiresAtMs`  |
| `event`                | `topics`, `service`, `aggregateType`, `event` |
| `subscribed`           | `topics`                                      |
| `unsubscribed`         | `topics`                                      |
| `subscription_denied`  | `topics`, `message`                           |
| `subscription_revoked` | `topics`, `message`                           |
| `heartbeat`            | _(none)_                                      |

### Client → Server

| Type          | Key Fields |
| ------------- | ---------- |
| `subscribe`   | `topics`   |
| `unsubscribe` | `topics`   |

## Serialization Helpers

| Function                 | Direction     | Description                                |
| ------------------------ | ------------- | ------------------------------------------ |
| `serializeServerMessage` | Server → wire | Serialize `ServerMessage` to JSON string   |
| `parseClientMessage`     | Wire → server | Parse JSON string, strict field validation |
| `parseServerMessage`     | Wire → client | Parse JSON string, discriminant check only |
| `serializeClientMessage` | Client → wire | Serialize `ClientMessage` to JSON string   |

Client-to-server parsing validates all required fields (type, topics array, string elements).
Server-to-client parsing validates only the `type` discriminant — the client trusts the server's format.

## API Reference

Full API documentation is generated from source and available at [docs/api](_media/README.md).

## License

MIT

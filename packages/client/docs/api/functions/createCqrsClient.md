[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / createCqrsClient

# Function: createCqrsClient()

> **createCqrsClient**\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>(`config`): `Promise`\<[`CqrsClient`](../classes/CqrsClient.md)\<`TLink`, `TCommand`\>\>

Create a new CQRS Client instance.

Resolves configuration, initializes the adapter, registers event processors,
wires all components, starts sync, and returns a fully initialized client.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../interfaces/EnqueueCommand.md)\<`unknown`\> = [`EnqueueCommand`](../interfaces/EnqueueCommand.md)\<`unknown`\>

### TSchema

`TSchema` = `unknown`

### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](../interfaces/IAnticipatedEvent.md)\<`string`, `AnticipatedAggregateEventData`\> = [`IAnticipatedEvent`](../interfaces/IAnticipatedEvent.md)\<`string`, `AnticipatedAggregateEventData`\>

## Parameters

### config

[`CqrsClientConfig`](../interfaces/CqrsClientConfig.md)\<`TLink`, `TCommand`, `TSchema`, `TEvent`\>

Client configuration

## Returns

`Promise`\<[`CqrsClient`](../classes/CqrsClient.md)\<`TLink`, `TCommand`\>\>

A fully initialized CQRS Client instance

## Example

```typescript
import { createCqrsClient } from '@cqrs-toolkit/client'

const client = await createCqrsClient({
  network: { baseUrl: '/api', wsUrl: 'ws://localhost:3000/events' },
  collections: [{ name: 'todos' }],
  processors: [
    {
      eventTypes: 'TodoCreated',
      processor: (data, ctx) => ({
        collection: 'todos',
        id: data.id,
        update: { type: 'set', data },
        isServerUpdate: ctx.persistence !== 'Anticipated',
      }),
    },
  ],
  commandSender: {
    async send(command) {
      const res = await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: command.type, data: command.data }),
      })
      if (!res.ok) throw new Error(`Command failed: ${res.status}`)
      return res.json()
    },
  },
})
```

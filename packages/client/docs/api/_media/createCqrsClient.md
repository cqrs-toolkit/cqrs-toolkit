[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / createCqrsClient

# Function: createCqrsClient()

> **createCqrsClient**\<`TLink`, `TSchema`, `TEvent`\>(`config`): `Promise`\<[`CqrsClient`](../classes/CqrsClient.md)\<`TLink`, [`EnqueueCommand`](../interfaces/EnqueueCommand.md)\<`unknown`\>\>\>

Create a new CQRS Client instance.

Resolves configuration, initializes the adapter, registers event processors,
wires all components, starts sync, and returns a fully initialized client.

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

### TSchema

`TSchema` = `unknown`

### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](../interfaces/IAnticipatedEvent.md)\<`string`, `AggregateEventData`\> = [`IAnticipatedEvent`](../interfaces/IAnticipatedEvent.md)\<`string`, `AggregateEventData`\>

## Parameters

### config

[`CqrsClientConfig`](../interfaces/CqrsClientConfig.md)\<`TLink`, `TSchema`, `TEvent`\>

Client configuration

## Returns

`Promise`\<[`CqrsClient`](../classes/CqrsClient.md)\<`TLink`, [`EnqueueCommand`](../interfaces/EnqueueCommand.md)\<`unknown`\>\>\>

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

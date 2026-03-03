[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / createCqrsClient

# Function: createCqrsClient()

> **createCqrsClient**(`config`): [`CqrsClient`](../interfaces/CqrsClient.md)

Defined in: packages/client/src/createCqrsClient.ts:175

Create a new CQRS Client instance.

## Parameters

### config

[`CqrsClientConfig`](../interfaces/CqrsClientConfig.md)

Client configuration

## Returns

[`CqrsClient`](../interfaces/CqrsClient.md)

A new CQRS Client instance

## Example

```typescript
import { createCqrsClient } from '@cqrs-toolkit/client'

const client = createCqrsClient({
  network: { baseUrl: '/api', wsUrl: 'ws://localhost:3000/events' },
  collections: [{ name: 'todos', seedOnInit: true }],
  commandSender: {
    async send(command) {
      const res = await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: command.type, payload: command.payload }),
      })
      if (!res.ok) throw new Error(`Command failed: ${res.status}`)
      return res.json()
    },
  },
})

client.registerProcessor({
  eventTypes: 'TodoCreated',
  processor: (data, ctx) => ({
    collection: 'todos',
    id: data.id,
    update: { type: 'set', data },
    isServerUpdate: ctx.persistence !== 'Anticipated',
  }),
})

await client.initialize()
```

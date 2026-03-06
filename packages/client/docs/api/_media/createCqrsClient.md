[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / createCqrsClient

# Function: createCqrsClient()

> **createCqrsClient**(`config`): `Promise`\<[`CqrsClient`](../classes/CqrsClient.md)\>

Defined in: [packages/client/src/createCqrsClient.ts:303](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/createCqrsClient.ts#L303)

Create a new CQRS Client instance.

Resolves configuration, initializes the adapter, registers event processors,
wires all components, starts sync, and returns a fully initialized client.

## Parameters

### config

[`CqrsClientConfig`](../interfaces/CqrsClientConfig.md)

Client configuration

## Returns

`Promise`\<[`CqrsClient`](../classes/CqrsClient.md)\>

A fully initialized CQRS Client instance

## Example

```typescript
import { createCqrsClient } from '@cqrs-toolkit/client'

const client = await createCqrsClient({
  network: { baseUrl: '/api', wsUrl: 'ws://localhost:3000/events' },
  collections: [{ name: 'todos', seedOnInit: true }],
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
        body: JSON.stringify({ type: command.type, payload: command.payload }),
      })
      if (!res.ok) throw new Error(`Command failed: ${res.status}`)
      return res.json()
    },
  },
})
```

[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../README.md) / createHypermediaCommandSender

# Function: createHypermediaCommandSender()

> **createHypermediaCommandSender**\<`TLink`, `TCommand`\>(`manifest`, `options`): `ICommandSender`\<`TLink`, `TCommand`\>

Create an `ICommandSender` that auto-wires HTTP requests from a `commands.json` manifest.

```ts
import manifest from './.cqrs/commands.json'
const sender = createHypermediaCommandSender(manifest, { baseUrl: 'http://localhost:3000' })
```

## Type Parameters

### TLink

`TLink` _extends_ `Link`\<`string`, `string`\>

### TCommand

`TCommand` _extends_ `EnqueueCommand`\<`unknown`\>

## Parameters

### manifest

[`CommandManifest`](../interfaces/CommandManifest.md)

### options

[`HypermediaCommandSenderOptions`](../interfaces/HypermediaCommandSenderOptions.md)\<`TLink`, `TCommand`\>

## Returns

`ICommandSender`\<`TLink`, `TCommand`\>

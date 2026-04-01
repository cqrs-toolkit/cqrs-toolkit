[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IAdapter

# Type Alias: IAdapter\<TLink, TCommand\>

> **IAdapter**\<`TLink`, `TCommand`\> = [`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md)\<`TLink`, `TCommand`\> \| [`IWorkerAdapter`](../interfaces/IWorkerAdapter.md)\<`TLink`, `TCommand`\>

Discriminated union of all adapter types.
Discriminant: `mode` field.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../interfaces/EnqueueCommand.md)

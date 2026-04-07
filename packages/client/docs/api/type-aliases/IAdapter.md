[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IAdapter

# Type Alias: IAdapter\<TLink, TCommand\>

> **IAdapter**\<`TLink`, `TCommand`\> = [`IWindowAdapter`](../interfaces/IWindowAdapter.md)\<`TLink`, `TCommand`\> \| [`IWorkerAdapter`](../interfaces/IWorkerAdapter.md)\<`TLink`, `TCommand`\>

Discriminated union of all adapter types.
Discriminant: `kind` — `'window'` (main-thread) vs `'worker'` (background process).

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](../interfaces/EnqueueCommand.md)

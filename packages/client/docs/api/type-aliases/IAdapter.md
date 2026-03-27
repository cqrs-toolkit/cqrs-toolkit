[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / IAdapter

# Type Alias: IAdapter\<TLink\>

> **IAdapter**\<`TLink`\> = [`IOnlineOnlyAdapter`](../interfaces/IOnlineOnlyAdapter.md)\<`TLink`\> \| [`IWorkerAdapter`](../interfaces/IWorkerAdapter.md)\<`TLink`\>

Discriminated union of all adapter types.
Discriminant: `mode` field.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

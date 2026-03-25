[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CqrsDebugAPI

# Interface: CqrsDebugAPI\<TLink, TSchema, TEvent\>

Debug API exposed to devtools extensions.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TSchema

`TSchema`

### TEvent

`TEvent` _extends_ [`IAnticipatedEvent`](IAnticipatedEvent.md)

## Properties

### cacheManager

> `readonly` **cacheManager**: [`ICacheManager`](ICacheManager.md)\<`TLink`\>

Cache manager interface for inspection.

---

### commandQueue

> `readonly` **commandQueue**: [`ICommandQueue`](ICommandQueue.md)

Command queue interface for inspection.

---

### config

> `readonly` **config**: [`ResolvedConfig`](ResolvedConfig.md)\<`TLink`, `TSchema`, `TEvent`\>

Resolved client configuration.

---

### debugStorage?

> `readonly` `optional` **debugStorage**: `DebugStorageAPI`

Raw SQL debug access (only available in worker modes).

---

### events$

> `readonly` **events$**: `Observable`\<[`LibraryEvent`](LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Observable of all library events (including debug events).

---

### queryManager

> `readonly` **queryManager**: [`IQueryManager`](IQueryManager.md)\<`TLink`\>

Query manager interface for inspection.

---

### role

> `readonly` **role**: `"leader"` \| `"standby"`

Role of this client instance.

---

### storage?

> `readonly` `optional` **storage**: [`IStorage`](IStorage.md)

Storage interface (only available in online-only mode).

---

### syncManager

> `readonly` **syncManager**: [`CqrsClientSyncManager`](CqrsClientSyncManager.md)

Sync manager interface for inspection.

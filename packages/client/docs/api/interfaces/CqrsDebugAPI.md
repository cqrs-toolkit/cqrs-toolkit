[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CqrsDebugAPI

# Interface: CqrsDebugAPI

Debug API exposed to devtools extensions.

## Properties

### cacheManager

> `readonly` **cacheManager**: [`ICacheManager`](ICacheManager.md)

Cache manager interface for inspection.

---

### commandQueue

> `readonly` **commandQueue**: [`ICommandQueue`](ICommandQueue.md)

Command queue interface for inspection.

---

### config

> `readonly` **config**: [`ResolvedConfig`](ResolvedConfig.md)

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

> `readonly` **queryManager**: [`IQueryManager`](IQueryManager.md)

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

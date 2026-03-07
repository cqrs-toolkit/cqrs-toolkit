[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CqrsDebugAPI

# Interface: CqrsDebugAPI

Defined in: [packages/client/src/types/debug.ts:26](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/debug.ts#L26)

Debug API exposed to devtools extensions.

## Properties

### cacheManager

> `readonly` **cacheManager**: [`ICacheManager`](ICacheManager.md)

Defined in: [packages/client/src/types/debug.ts:34](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/debug.ts#L34)

Cache manager interface for inspection.

---

### commandQueue

> `readonly` **commandQueue**: [`ICommandQueue`](ICommandQueue.md)

Defined in: [packages/client/src/types/debug.ts:30](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/debug.ts#L30)

Command queue interface for inspection.

---

### config

> `readonly` **config**: [`ResolvedConfig`](ResolvedConfig.md)

Defined in: [packages/client/src/types/debug.ts:42](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/debug.ts#L42)

Resolved client configuration.

---

### debugStorage?

> `readonly` `optional` **debugStorage**: `DebugStorageAPI`

Defined in: [packages/client/src/types/debug.ts:40](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/debug.ts#L40)

Raw SQL debug access (only available in worker modes).

---

### events$

> `readonly` **events$**: `Observable`\<[`LibraryEvent`](LibraryEvent.md)\<[`LibraryEventType`](../type-aliases/LibraryEventType.md)\>\>

Defined in: [packages/client/src/types/debug.ts:28](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/debug.ts#L28)

Observable of all library events (including debug events).

---

### queryManager

> `readonly` **queryManager**: [`IQueryManager`](IQueryManager.md)

Defined in: [packages/client/src/types/debug.ts:32](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/debug.ts#L32)

Query manager interface for inspection.

---

### role

> `readonly` **role**: `"leader"` \| `"standby"`

Defined in: [packages/client/src/types/debug.ts:44](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/debug.ts#L44)

Role of this client instance.

---

### storage?

> `readonly` `optional` **storage**: [`IStorage`](IStorage.md)

Defined in: [packages/client/src/types/debug.ts:38](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/debug.ts#L38)

Storage interface (only available in online-only mode).

---

### syncManager

> `readonly` **syncManager**: [`CqrsClientSyncManager`](CqrsClientSyncManager.md)

Defined in: [packages/client/src/types/debug.ts:36](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/debug.ts#L36)

Sync manager interface for inspection.

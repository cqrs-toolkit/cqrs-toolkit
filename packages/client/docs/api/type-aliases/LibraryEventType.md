[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / LibraryEventType

# Type Alias: LibraryEventType

> **LibraryEventType** = `"session:changed"` \| `"session:destroyed"` \| `"connectivity:changed"` \| `"sync:started"` \| `"sync:completed"` \| `"sync:failed"` \| `"cache:evicted"` \| `"cache:too-many-windows"` \| `"cache:session-reset"` \| `"sync:seed-completed"` \| `"command:enqueued"` \| `"command:status-changed"` \| `"command:completed"` \| `"command:failed"` \| `"readmodel:updated"` \| `"error:storage"` \| `"error:network"` \| `"ws:connecting"` \| `"ws:connected"` \| `"ws:subscribed"` \| `"ws:disconnected"`

Defined in: [packages/client/src/types/events.ts:40](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/events.ts#L40)

Library-level events emitted to consumers.

[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / LibraryEventType

# Type Alias: LibraryEventType

> **LibraryEventType** = `"session:changed"` \| `"session:destroyed"` \| `"connectivity:changed"` \| `"sync:started"` \| `"sync:completed"` \| `"sync:failed"` \| `"cache:evicted"` \| `"cache:too-many-windows"` \| `"cache:session-reset"` \| `"sync:seed-completed"` \| `"command:enqueued"` \| `"command:status-changed"` \| `"command:completed"` \| `"command:failed"` \| `"readmodel:updated"` \| `"error:storage"` \| `"error:network"` \| `"ws:connecting"` \| `"ws:connected"` \| `"ws:subscribed"` \| `"ws:disconnected"` \| `"sync:ws-event-received"` \| `"sync:ws-event-processed"` \| `"sync:gap-detected"` \| `"sync:gap-repair-started"` \| `"sync:gap-repair-completed"` \| `"cache:key-acquired"` \| `"sync:refetch-scheduled"` \| `"sync:refetch-executed"` \| `"command:sent"` \| `"command:response"`

Defined in: [packages/client/src/types/events.ts:40](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L40)

Library-level events emitted to consumers.

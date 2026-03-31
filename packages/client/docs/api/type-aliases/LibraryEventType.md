[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / LibraryEventType

# Type Alias: LibraryEventType

> **LibraryEventType** = `"session:changed"` \| `"session:destroyed"` \| `"connectivity:changed"` \| `"sync:started"` \| `"sync:completed"` \| `"sync:failed"` \| `"cache:key-added"` \| `"cache:key-accessed"` \| `"cache:evicted"` \| `"cache:frozen-changed"` \| `"cache:quota-low"` \| `"cache:quota-critical"` \| `"cache:too-many-windows"` \| `"cache:session-reset"` \| `"cache:seed-settled"` \| `"sync:seed-completed"` \| `"command:enqueued"` \| `"command:status-changed"` \| `"command:completed"` \| `"command:failed"` \| `"readmodel:updated"` \| `"error:storage"` \| `"error:network"` \| `"ws:connecting"` \| `"ws:connected"` \| `"ws:subscribed"` \| `"ws:disconnected"` \| `"sync:ws-event-received"` \| `"sync:ws-event-processed"` \| `"sync:gap-detected"` \| `"sync:gap-repair-started"` \| `"sync:gap-repair-completed"` \| `"sync:refetch-scheduled"` \| `"sync:refetch-executed"` \| `"command:sent"` \| `"command:response"` \| `"writequeue:op-enqueued"` \| `"writequeue:op-started"` \| `"writequeue:op-completed"` \| `"writequeue:op-error"` \| `"writequeue:op-discarded"` \| `"writequeue:reset-started"` \| `"writequeue:reset-completed"`

Library-level events emitted to consumers.

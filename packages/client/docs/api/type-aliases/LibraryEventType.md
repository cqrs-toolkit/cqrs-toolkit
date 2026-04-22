[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / LibraryEventType

# Type Alias: LibraryEventType

> **LibraryEventType** = `"cache:key-added"` \| `"cache:key-accessed"` \| `"cache:evicted"` \| `"cache:frozen-changed"` \| `"cache:quota-low"` \| `"cache:quota-critical"` \| `"cache:too-many-windows"` \| `"cache:session-reset"` \| `"cache:key-reconciled"` \| `"cache:seed-settled"` \| `"connectivity:changed"` \| `"command:enqueued"` \| `"command:status-changed"` \| `"command:completed"` \| `"command:failed"` \| `"command:cancelled"` \| `"command:sent"` \| `"command:response"` \| `"commandqueue:paused"` \| `"commandqueue:resumed"` \| `"debug:log"` \| `"error:storage"` \| `"error:network"` \| `"readmodel:updated"` \| `"readmodel:id-reconciled"` \| `"session:changed"` \| `"session:destroyed"` \| `"sync:started"` \| `"sync:completed"` \| `"sync:failed"` \| `"sync:gap-detected"` \| `"sync:gap-repair-started"` \| `"sync:gap-repair-completed"` \| `"sync:invalidate-requested"` \| `"sync:refetch-scheduled"` \| `"sync:refetch-executed"` \| `"sync:seed-completed"` \| `"sync:ws-event-received"` \| `"sync:ws-event-processed"` \| `"writequeue:op-enqueued"` \| `"writequeue:op-started"` \| `"writequeue:op-completed"` \| `"writequeue:op-error"` \| `"writequeue:op-discarded"` \| `"writequeue:reset-started"` \| `"writequeue:reset-completed"` \| `"ws:connecting"` \| `"ws:connected"` \| `"ws:subscribed"` \| `"ws:disconnected"`

Library-level events emitted to consumers.

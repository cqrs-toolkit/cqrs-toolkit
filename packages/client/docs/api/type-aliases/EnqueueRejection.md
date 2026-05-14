[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EnqueueRejection

# Type Alias: EnqueueRejection

> **EnqueueRejection** = [`ValidationException`](../classes/ValidationException.md) \| [`UnknownCommandException`](../classes/UnknownCommandException.md) \| [`ConflictException`](../classes/ConflictException.md)

Reasons the enqueue operation can fail.

Validation failure (`ValidationException`) and missing handler registration
(`UnknownCommandException`) prevent the command from entering the queue.
Handler-returned `'conflict'` outcomes (`ConflictException`) currently flow
out the same path while the queue lacks a "persist as failed" routing —
task #13 will narrow this union back to validation/unknown when conflicts
are persisted instead of rejected.

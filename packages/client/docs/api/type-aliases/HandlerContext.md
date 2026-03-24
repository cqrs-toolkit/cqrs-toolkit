[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / HandlerContext

# Type Alias: HandlerContext

> **HandlerContext** = [`InitializingContext`](../interfaces/InitializingContext.md) \| [`UpdatingContext`](../interfaces/UpdatingContext.md)

Context passed to command handlers.

Discriminated union on `phase`. During `'updating'`, `entityId` is always present —
create handlers use it to preserve identity stability across regeneration.

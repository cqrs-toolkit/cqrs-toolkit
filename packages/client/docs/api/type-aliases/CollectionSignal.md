[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CollectionSignal

# Type Alias: CollectionSignal

> **CollectionSignal** = \{ `commandIds`: `string`[]; `ids`: `string`[]; `type`: `"updated"`; \} \| \{ `recordCount`: `number`; `type`: `"seed-completed"`; \} \| \{ `error`: `string`; `type`: `"sync-failed"`; \}

Signal emitted by `watchCollection`.
Discriminated union covering data updates, seed completion, and sync failures.

`'updated'` carries the command IDs whose effects produced this batch — empty
when the update is server-driven (seed, gap repair, propagated event with no
local origin). Consumers that wait for a specific command to settle can
filter on `commandIds.includes(commandId)` without subscribing to the
lower-level event bus.

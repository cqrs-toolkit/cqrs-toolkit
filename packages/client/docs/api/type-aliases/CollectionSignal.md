[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CollectionSignal

# Type Alias: CollectionSignal

> **CollectionSignal** = \{ `ids`: `string`[]; `type`: `"updated"`; \} \| \{ `recordCount`: `number`; `type`: `"seed-completed"`; \} \| \{ `error`: `string`; `type`: `"sync-failed"`; \}

Signal emitted by `watchCollection`.
Discriminated union covering data updates, seed completion, and sync failures.

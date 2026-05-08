# ADR 0006 (client) — `CommandStore`: in-memory ownership of `CommandRecord` lifecycle

**Status:** Accepted 2026-04-22

## Context

Before this change, command-record lifecycle was scattered across `CommandQueue` and `SyncManager`, both of which called `IStorage` directly for command reads and writes.
A single sync pipeline run hit storage many times — `getCommand` for staleness checks, `getCommandsByStatus` for batch loads, `updateCommand` per status transition, `updateCommands` for bulk pipeline updates, plus `getCommand` fallbacks during reconciliation.

Two pressures came out of this:

1. **Race conditions between WriteQueue ops and command processing.**
   Stale in-memory snapshots persisted across async gaps, while concurrent storage writes mutated the same rows.
   The narrow race in `processCommand` (loop holding stale records, `updateCommandStatus` blindly overwriting a `cancelled` status) was the canonical example, but the same shape recurred across the call sites.
2. **Storage-redundant work in the sync pipeline.**
   Reconcile loaded commands, mutated them in memory, and then called `storage.updateCommands(...)` with a fresh snapshot — when the in-memory references the pipeline already held *were* the system of record after the load.

A second concern was submit ordering.
Commands had to be processed in submit order, but `createdAt` timestamps were non-monotonic across rapid submits (clock granularity) and were vulnerable to clock drift.
The SQL table already had a `seq INTEGER PRIMARY KEY AUTOINCREMENT` column — an authoritative monotonic sequence — but it was not used as the canonical ordering key.

## Decision

Introduce `CommandStore` (`packages/client/src/core/command-store/CommandStore.ts`) as the sole owner of `CommandRecord` lifecycle in memory.
All code that loads, mutates, or saves a command record goes through `CommandStore`; no other component touches `IStorage` for command records.

### Memory model

- **Active map**: `Map<string, CommandRecord>` keyed by `commandId`. Loaded on `initialize()` from `storage.getCommandsByStatus([non-terminal + succeeded])`.
- **TTL cache**: stores terminal commands (`applied`, `failed`, `cancelled`) for a configurable window. Pure memory management — no storage side effects on eviction. A terminal command loaded from storage via `get()` enters the TTL cache; an evicted command re-loaded later goes back into the cache.
- **In-memory references are the system of record after load.** The pipeline mutates the same object reference that `CommandStore` holds — no copy, no diff. Persistence sees those mutations on flush.

### Storage consultation rules

- **In-memory statuses** (always loaded): `pending`, `blocked`, `sending`, `succeeded`.
- **Storage-only statuses** (evicted from active map after terminal cleanup): `applied`, `failed`, `cancelled`.
- `get(id)` — active map → TTL cache → `IStorage`. Terminal results from storage land in the TTL cache.
- `getByStatus(s)` — in-memory only when `s` is fully in-memory; merge with storage results when any status is storage-only.
- `getBlockedBy(id)` — in-memory scan only; blocked commands are always in memory.
- `list(filter)` — same status-aware logic.

### Mutation API

- `save(command)` — assigns the next sequence number, writes to active map, writes to `IStorage` immediately (must be durable before `enqueue()` returns to the caller — they may navigate away).
- `update(commandId, updates)` — synchronous. Mutates the in-memory reference via `Object.assign`, marks dirty. Returns `boolean` for found-or-not. Terminal transitions move the record from active map to TTL cache. `SyncManager` treats `false` as a harmless no-op (the command was cleaned up between load and write-back); `CommandQueue` callers decide whether `false` is a bug.
- `batchUpdate(updates[])` — same semantics per entry; returns the count updated. Used by sync pipeline's Phase 6 step 1 (rewritten commands) and `batchUpdateSyncStatus` (applied transition).
- `delete(commandId)` — removes from memory; schedules storage delete via the flush queue.
- `flush()` — force-flush, awaiting any in-flight write.

### Flush queue (mini write queue)

- `Set<string>` dirty IDs and `Set<string>` delete IDs.
- At most one `IStorage` write promise in flight at a time.
- When a flush completes, if either set is non-empty, a new flush fires immediately on the coalesced sets.
- Flushes use `storage.updateCommands()` for batch efficiency; deletes go through `storage.deleteCommand()` under the same single-flight guard.
- `save()` bypasses the flush queue and writes immediately (durability is required before `enqueue()` returns); the queue exists for steady-state mutations after save.

### Initialization gate

All read/write methods await an internal `ready` promise before proceeding.
Callers arriving before `initialize()` resolves are naturally delayed — no explicit error, just backpressure.

### Sequence numbers

`seq: number` becomes a required field on `CommandRecord`.

- SQLite: `seq INTEGER PRIMARY KEY AUTOINCREMENT` is authoritative.
  `saveCommand()` does *not* include `seq` in the INSERT column list — autoincrement assigns it.
  `IStorage.getCommandSequence(): Promise<number>` reads from `sqlite_sequence` (`SELECT seq FROM sqlite_sequence WHERE name = 'commands'`) so deleted tail rows do not cause the counter to regress; falls back to `0` when no row has been inserted yet.
- InMemory: stores whatever `seq` the record carries (assigned by `CommandStore`); `getCommandSequence()` returns the highest `seq` across stored records, or `0` if none.
- On `initialize()`, `CommandStore` reads `getCommandSequence()` and sets `nextSeq = result + 1`.
  `save()` assigns `nextSeq++` to `command.seq` before writing.
  CommandStore is the sole writer, so the in-memory seq and SQL autoincrement stay aligned.
- All list / `getByStatus` / `list` results sort by `seq`. `InMemoryStorage.getCommands()` ordering changes from `createdAt` to `seq`.

## Consequences

**Easier:**
- Race conditions between sync pipeline mutations and storage writes are gone — the pipeline mutates the same in-memory object the store holds; the flush queue serializes durable persistence.
- Sync pipeline Phase 6 step 1 ("save rewritten commands") is now `commandStore.batchUpdate(...)` — synchronous mutation in memory, single flush at end of pipeline. Eliminates redundant load-then-save round-trips.
- Submit ordering is monotonic and authoritative via `seq`. Clock drift, fast submits, and timestamp granularity stop affecting order.
- `CommandQueue` and `SyncManager` no longer call `IStorage` for command records. Both classes retain `IStorage` access only for *other* concerns (event cache, command-id mappings); command-record IO is fully through `CommandStore`.

**Harder:**
- Two layers (active map + TTL cache) mean `get()` has three places to check. Performance cost is negligible (in-memory lookups), but the mental model is non-trivial.
- The TTL on terminal commands is a memory tradeoff. Too short → frequent re-loads from storage; too long → unbounded memory growth on long sessions. Configurable; default chosen empirically.
- `update()` returning `boolean` means callers must consciously decide what `false` signifies in their context. Two callers with two interpretations is an intentional split — `SyncManager` is post-load and tolerates evictions; `CommandQueue` is the authoritative path and a `false` may indicate a bug.

## Notes

The `CommandIdMappingStore` (`packages/client/src/core/command-id-mapping-store/`) follows the same memory-first peer-of-IStorage pattern for the command-id-mapping cache:
- Sync `get` / `getByServerId` / `getMany` against in-memory indices.
- Lazy-flush writes through `mappingStore.save`.
- TTL sweep.
- Init via `IStorage.loadAndPurgeCommandIdMappings` (single-transaction delete-then-load).

This ADR's scope is `CommandStore` specifically.
The broader enqueue overhaul that introduced `CommandIdMappingStore` is partially shipped — the unified-pass replacement of `patchFromIdMappingCache`, the `rewriteCommandsWithStaleIds` body replacement, the `SyncManager` legacy fallback delete, and the `ParentRefConfig` removal are remaining work that this ADR does not cover.

`retainTerminal` is accepted as `CommandStore` config but its storage-side effects are not yet determined; today it does not influence TTL cache behavior.

## Related

- [ADR 0004 (client)](0004-aggregates-as-first-class.md) — Aggregates as a first-class concept on `Collection`.
- [ADR 0005 (client)](0005-reconcile-entry-point-split.md) — Reconcile entry-point split. Phase 6 step 1 is the canonical batch-update consumer of `CommandStore.batchUpdate()`.
- [ADR 0003 (client)](0003-server-data-pipeline-rewrite.md) — Server data pipeline rewrite. The command-record ownership slice of that umbrella rewrite; consolidating command-record memory is one of the single-owner inversions [ADR 0003](0003-server-data-pipeline-rewrite.md) enumerates.

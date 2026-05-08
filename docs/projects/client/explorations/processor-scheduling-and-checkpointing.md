# Processor scheduling and checkpointing strategy

## Context

How event processors are scheduled and how their progress is checkpointed across reloads / crashes is an implementation choice. The library's correctness contract requires deterministic results, resumability after crashes or reloads, and no partial application leading to corrupted effective state — but the means to that end are not prescribed.

Surfaced from the previous open-ambiguities section.

## Open considerations

Acceptable strategies include any combination of:

- **Strict serialization per `(collection, cacheKey)`** — process one event at a time per pair; simple but limits throughput.
- **Batched processing with checkpoints** — accumulate events into batches, write batches transactionally, checkpoint progress; higher throughput, more complex recovery semantics.
- **Transactional DB operations** — wrap apply-events in a SQLite transaction; relies on storage-layer atomicity for crash safety.
- **Equivalent mechanisms** — anything else that satisfies the correctness contract.

## Hard requirements (preserved across any strategy)

- Deterministic results
- Resumability after crashes or reloads
- No partial application leading to corrupted effective state

## Status

Open. Implementation choice; multiple strategies are acceptable. Current implementation uses the write queue + transactional approach in worker modes.

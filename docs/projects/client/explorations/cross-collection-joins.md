# Cross-collection joins

## Context

A real application built on this library needs cross-collection join capability — for example, fetching the notes for a notebook plus their tags in one query, where the relationship is expressed via a link table.

The intent appears in [`§9.5.3`](../intent/requirements/0009-query-manager.md#953-cross-collection-joins) of `0009-query-manager.md`. No implementation exists yet.

## Observation

Surfaced during 2026-05-07 review. The earlier sketch shape `join<T>({ baseCollection, joinCollection, on, filter? })` captured the goal but doesn't account for the dual-backend reality (in-memory in Mode A, SQL in worker modes).

## Likely shape

A **dual-mode-aware escape hatch**: the consumer provides both an in-memory implementation (closure over the raw `IStorage` Map) and a SQL query (string with parameter bindings). The Query Manager dispatches based on the active `IStorage` implementation.

Sketch:

```ts
join<T>({
  inMemory: (storage: InMemoryStorage) => T[] | Promise<T[]>,
  sql: { query: string, params: unknown[] },
}): Promise<T[]>
```

Pros:

- Honest about the dual-backend reality; doesn't pretend either backend is universal.
- Lets consumers express joins idiomatically for each backend.
- Keeps the library out of the join-engine business — the consumer owns the query semantics.

Cons:

- Forces consumers to write each query twice.
- Cross-implementation correctness is the consumer's responsibility (the two implementations must produce the same results given the same data).

## Alternatives considered

- Library-provided SQL-like predicate engine that compiles to both backends. Too much engineering for what's effectively an escape hatch. Defer.
- In-memory-only joins (require Mode A semantics in worker modes too, by reading raw rows up to memory). Defeats the SQL-backend efficiency advantage.

## Status

Open. Implementation will land when a real consumer use case forces the design.

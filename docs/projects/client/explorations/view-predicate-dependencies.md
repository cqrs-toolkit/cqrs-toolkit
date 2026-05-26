# View predicate dependencies

## Context

Cross-collection views ([`cross-collection-joins.md`](cross-collection-joins.md)) currently invalidate on three id-based gates: tracked primary, tracked referenced join (`referencedIds`), and missing referenced join (`referencingIds`, added 2026-05-21). All three operate on **known ids** — sets the proxy can compute from the most recent result data.

A class of views falls outside this model: their dependency is **predicate-based** — they care about _any_ row in a target collection matching some filter, where the matching set isn't known up front. Canonical example: "latest note in notebook X." The view's result is one row chosen from all notes matching `notebookId === X`; an entirely new note arriving in that notebook must trigger a re-run, but the executor has no way to express "I want all notes matching this predicate" in the existing id-based gate machinery.

## Observations

- The predicate's filter parameters are known up front (from `params`), so the gate criterion is itself parameterised, not row-derived.
- The set of matching ids is unbounded — listing them eagerly would defeat the purpose (you'd be replicating the read model index in JS).
- Per-event evaluation needs access to the touched row data (notebookId is a field on the note), not just the id — so the executor would have to fetch by id before applying the predicate.

## Scope

In: views that depend on "some row in collection X matches a filter parameterised by view params."

Out:

- Id-based dependencies — covered by the existing three-gate model.
- View result selection / aggregation semantics — orthogonal; the predicate is about _what to watch_, not _how to combine_.

## Tentative shape

The natural home is the cache-key system on the target collection, not the view registration. The inverse of the existing `cacheKeysFromTopics(topics)` — given a row in this collection, what cache keys does it belong to?

```ts
interface Collection<TLink> {
  // existing:
  cacheKeysFromTopics(
    topics: readonly string[],
  ): (CacheKeyIdentity<TLink> | CacheKeyTemplate<TLink>)[]
  // new:
  cacheKeysFromRow?(row: unknown): CacheKeyTemplate<TLink>[]
}
```

Evaluated on every seed/create/update for that collection (within the existing commit pipeline). Anything subscribed to a resulting cache key gets touched and re-runs — views, list queries, getById watchers all benefit uniformly.

The latest-note-in-notebook view then becomes:

```ts
// notes collection
cacheKeysFromRow: (note) => [
  {
    kind: 'scope',
    scopeType: 'notes-in-notebook',
    scopeParams: { notebookId: note.notebookId },
  },
]

// view registration
cacheKeys: (params) => [
  {
    kind: 'scope',
    scopeType: 'notes-in-notebook',
    scopeParams: { notebookId: params.notebookId },
  },
]
```

When a matching note arrives, its cache-key resolution produces the same template the view subscribed to → the cache key is touched → the view re-runs.

## Why this isn't on the view

A `matches(eventRow, params) => boolean` predicate on `joinSources[]` would also work, but:

- It pushes evaluation onto every consumer (view) rather than centralising on the producer (target collection). N views with predicates on the notes collection each evaluate per event; one collection-level `cacheKeysFromRow` evaluates once.
- It splits "what cache keys does this row belong to" between WS topic ingest (`cacheKeysFromTopics`) and local row events (`matches` on each view) — same question, two answers.
- It can't be reused for list queries on the same predicate.

The collection-level form is the more general primitive.

## Open questions

- **Predicate evaluation cost vs. eager indexing.** On every commit, every row in changed collections runs `cacheKeysFromRow`. At write throughput, this is one closure call per row per declaration. Compared to the cache-key reverse index it would replace, the cost is bounded by write volume not subscription count — probably fine, but worth measuring on a bulk-seed.
- **Multi-template support.** The current cache-key model has a row belong to _one_ identity per shape. Predicate-driven membership can produce _several_ templates per row (a single note might belong to "notes in notebook X" _and_ "notes by author Y" _and_ "notes with tag Z"). The cache-key reverse-index machinery needs to handle this fan-out without duplicate notifications.
- **Interaction with `cacheKeysFromTopics`.** WS topics already produce cache keys; `cacheKeysFromRow` would produce them again from local row data. Are these guaranteed to agree? Probably yes (they're declaring the same membership), but the consumer authoring both needs to keep them in sync. Worth considering whether one can derive the other.
- **Cache-key creation semantics.** If `cacheKeysFromRow` produces a template that doesn't yet have a registered identity, do we create one eagerly (and start tracking it)? Or only touch existing keys? Eager creation could leak — every unique notebookId produces a cache-key entry whether anyone watches it. Lazy (touch-only) means a predicate-driven view started after the row arrived would miss the membership.
- **Composition with the existing three gates.** A view could use predicate deps via `cacheKeys()` _and_ id-based join deps via `joinSources[]` simultaneously. The gates compose additively (any of them firing triggers a re-run), so no design conflict expected — but a worked example would confirm.

## Alternatives considered

- **Per-`joinSources[]` `matches(eventRow, params)` predicate.** Rejected for the reasons in "Why this isn't on the view" above.
- **Subscribe to all events on the dependent collection and re-fetch on each.** Trivially correct, catastrophically inefficient at the scale ([cross-collection-joins.md](cross-collection-joins.md) calls out the 2026-05-18 decision to reject any-event re-execution).
- **Declare the dependency as a SQL trigger or materialised view.** SQLite supports both, but they only fire in the SQL backend — Mode A (in-memory) has no equivalent. The mode-parity constraint rules this out as the _primary_ mechanism, though it remains an optimisation the consumer could layer on for SQL-backed views.

## Status

Deferred. The id-based wanted-id gate ([cross-collection-joins.md](cross-collection-joins.md)) covers the currently-shipping views; predicate-based dependencies become load-bearing when a view of the latest-note-in-notebook shape lands in scope. Revisit then.

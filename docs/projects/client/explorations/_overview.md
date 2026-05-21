# explorations/ (client)

Design alternatives under evaluation; things to investigate before they become committed scope (a requirement) or a settled choice (an ADR).
Mutable — entries are edited as understanding develops, then resolve up into another wing or are dropped.

## Distinguished from neighbours

- **vs `intent/requirements/`**: requirements describe _what the project commits to building_; explorations describe _what we're considering_. An exploration that the project commits to becomes a requirement.
- **vs `decisions/`**: ADRs are settled choices with rationale; explorations are open questions with candidate answers. An exploration that resolves into a chosen approach spawns an ADR; the exploration is then either deleted or trimmed and pointed at the ADR.
- **vs `mindset/`**: mindset is how to _think_ about a class of problems (analytical framing); explorations are _what to do_ about a specific open question (candidate answers under evaluation).

## Naming

Descriptive slugs (`<topic>.md`); no `NNNN-` prefix. Explorations are mutable and can be deleted, so monotonic numbering would be churn for no benefit.

## Lifecycle

An exploration entry exists while the question is open. When it resolves:

- **Committed to scope** → write the requirement in `intent/requirements/NNNN-slug.md`. If the exploration is being consumed (the new requirement replaces it), `git mv explorations/<slug>.md intent/requirements/NNNN-<slug>.md` first, then rewrite the content to fit the requirement shape — VCS history follows the move. If the exploration is being kept with a pointer at the new requirement (the alternatives discussion remains useful for trace), create the requirement file separately and trim the exploration down to the pointer.
- **Resolved into a settled approach** → write the ADR in `decisions/`. Same pattern: `git mv` when consuming; separate-file when keeping the exploration with a pointer.
- **Generalized into a normative convention** → pattern entry in `patterns/`. Same `git mv` pattern when consuming.
- **Investigated and rejected** → keep the exploration in place with a status header at the top noting the resolution and reason (e.g., `Status: Archived 2026-MM-DD — investigated; didn't pursue because X`). The wing index keeps the entry, marked inline (e.g., `— archived: rejected because X`). Future contributors get "we already looked at this, here's why" without repeating the investigation.
- **Trivially obsolete** (the underlying problem went away or the framing turned out to be confused) → delete; no archive value.

Promotion (the first three cases) updates the wing index by removal: the entry's now-canonical home is in another wing.
Archive (rejected) keeps the entry indexed but marked, so it remains discoverable as the answer to a question someone might re-ask.

## Entries

- [`command-dependency-hard-soft-classification.md`](command-dependency-hard-soft-classification.md) — resolved into [ADR-0009](../decisions/0009-hard-soft-dependency-classification.md); file now holds only the deferred open questions (cross-aggregate edges, chain snapshot on the classifier signature).
- [`command-enqueued-cache-hook.md`](command-enqueued-cache-hook.md) — optional `onCommandEnqueued` callback driven by cache-key state; whether and how to surface it on the command queue API.
- [`cross-collection-joins.md`](cross-collection-joins.md) — supporting joins across collections (notes ↔ tags via link tables) at the query layer.
- [`event-history-storage.md`](event-history-storage.md) — per-collection opt-in to retain full event history for revision-on-demand state lookups; reuses the existing event-processor pipeline against an in-memory accumulator.
- [`handler-input-init-current.md`](handler-input-init-current.md) — splitting anticipated-handler input into `{ init, current }` state to expose what changed between submit and execute.
- [`item-metadata-shape.md`](item-metadata-shape.md) — whether `ItemMeta` (id, updatedAt, clientId?, revision?) returns alongside item data or is embedded in it.
- [`local-event-metadata.md`](local-event-metadata.md) — implemented 2026-05-12. Local (anticipated) events now carry optional `metadata` mirroring server-side `IPersistedEvent.metadata` locations, so projector code reads `event.metadata?.inTenant` uniformly and rows match server projection without flicker. Closes the long-standing TBD on `IAnticipatedEvent.metadata`.
- [`query-collection-metadata.md`](query-collection-metadata.md) — sync getter vs observable signals for query-level collection metadata access.
- [`serverdata-drop-when-no-overlay.md`](serverdata-drop-when-no-overlay.md) — dropping `_server_data` when it's identical to `_effective_data` (no overlay) to halve per-record storage.
- [`stateful-event-redesign.md`](stateful-event-redesign.md) — replacing the seed-re-execution stateful invalidation behaviour with a more targeted design.

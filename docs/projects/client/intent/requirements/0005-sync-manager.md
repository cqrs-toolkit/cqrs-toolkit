# 5\. Sync Manager (Network & Synchronization Orchestrator)

## 5.1 Purpose

The Sync Manager is the **network-facing orchestration component** responsible for keeping local read model snapshots and event caches up to date for all **active cache keys**, using REST API requests and WebSocket subscriptions (with polling fallback).

It owns:

- when network activity is allowed to occur

- how data is seeded, incrementally updated, repaired, or refetched

- how authentication, connectivity, and offline/online transitions affect synchronization

The Sync Manager **does not expose read state directly**; it produces and updates local state consumed via the Query Manager.

---

## 5.2 Responsibilities

The Sync Manager is responsible for the following:

### 5.2.1 Cache key–driven lifecycle

- Observe Cache Manager events to drive synchronization lifecycle:
  - on `CacheKeyAdded` / `CacheKeyAccessed`:
    - if the key is **active** (held by at least one window), ensure all configured collections for that key are seeded and kept up to date

  - on `CacheKeyEvicted`:
    - immediately stop all network activity for that key

    - unsubscribe from all WebSocket topics for that key

    - cancel in-flight fetches

    - delete key-scoped sync metadata

### 5.2.2 Collection synchronization

For each configured collection associated with an active cache key:

- **Seed**: load the authoritative snapshot via REST pagination

- **Subscribe**: receive incremental updates via WebSocket topics (or polling fallback)

- **Gap repair**: detect missing permanent events and fetch them via REST

- **Stateful invalidation handling**: apply stateful events best-effort or refetch affected collections

### 5.2.3 Event handling & propagation

- Write permanent and stateful events into the Event Cache

- Trigger read model processing by emitting internal “events appended / invalidated” signals

- Ensure ordering guarantees and gap repair requirements are upheld before processors apply events

### 5.2.4 Network gating & session awareness

- Defer, pause, or resume network activity based on:
  - authentication state

  - network availability

  - server reachability (circuit breaker)

- Coordinate with the Connectivity Manager (see [§5.3](#53-connectivity-manager-sync-manager-subcomponent))

---

## 5.3 Connectivity Manager (Sync Manager subcomponent)

The Connectivity Manager is a **subcomponent of the Sync Manager** and is the single authority for determining whether network activity is allowed.

### 5.3.1 Connectivity state

The Connectivity Manager maintains the following derived state:

- `network: 'online' | 'offline' | 'unknown'`

- `serverReachable: 'yes' | 'no' | 'unknown'`

- `auth: 'valid' | 'invalid' | 'unknown'`

- `mode: 'normal' | 'paused' | 'degraded'`

### 5.3.2 Authentication signaling (application-driven)

The application **must explicitly signal authentication state** to the Sync Manager:

- `setAuthenticated({ userId: string })`

- `setUnauthenticated()` (optional)

Rules:

- The Sync Manager **must not initiate any network requests** unless:
  - `auth === 'valid'`

  - `network !== 'offline'`

  - the circuit breaker is closed

- Authentication may be unknown at startup to allow offline-first initialization.

### 5.3.3 Offline-first startup behavior

On application startup:

1.  The Sync Manager loads the last persisted session (if any).

2.  `auth` is set to `'unknown'`.

3.  All network activity is paused.

4.  Existing cached data is made available for querying.

5.  Network activity resumes only after `setAuthenticated` is called.

### 5.3.4 Session user change handling

When `setAuthenticated({ userId })` is called:

- If no prior session exists:
  - create a new persisted session

  - resume network activity

- If prior session exists and `userId` matches:
  - resume network activity

- If prior session exists and `userId` differs (user mismatch detected):
  - emit `SessionDestroyed` with `reason: 'user-changed'` (the runtime signal consumers can subscribe to for UX prompts)

  - perform a **full local data wipe** (see [§5.9](#59-user-mismatch-data-wipe-hard-reset))

  - emit `SessionChanged { userId, isNew: true }` once the new session is created

  - resume network activity

---

## 5.4 Collection interface

Each synchronized collection implements the `Collection<TLink>` interface from `@cqrs-toolkit/client`.
The interface gives consumer code full control over WebSocket topic resolution, event routing, and HTTP conventions.
The library never parses stream IDs, constructs URLs, or interprets HTTP response shapes.

A `Collection` is backed by exactly one primary aggregate (`aggregate: AggregateConfig<TLink>`).
Composite collections built from multiple aggregates are future work and will not be a variant of this interface.

The interface is structured so that **opting into a seeding mode requires its corresponding loading config to be complete** — the sub-config type bundles together everything that mode needs. Previously these fields were independently optional and partial configs surfaced as runtime misbehavior (e.g. a collection that asked for on-demand seeding but had no `subscribeTopics`). The current shape makes partial mode configs unrepresentable at the type level.

### 5.4.1 Required members

- `name: string` — unique collection identifier.
- `aggregate: AggregateConfig<TLink>` — the primary aggregate this collection tracks. Provides stream ID derivation and aggregate identity (`type`, and `service` for `ServiceLink`). See [0015](0015-aggregate-config.md).
- `cacheKeysFromTopics(topics: readonly string[])` — at WS event ingestion: given incoming event topics, resolve which cache keys (or templates for unresolved IDs) this event belongs to. Returned identities/templates are attached to the event before processing.
- `matchesStream(streamId: string): boolean` — test whether events from this stream ID apply to this collection — `true` for the collection's own aggregate streams as well as any cross-aggregate streams whose events update this collection's read model. Multiple collections may match the same streamId.

### 5.4.2 Mode opt-ins

- `seedOnInit?: SeedOnInitConfig<TLink>` — auto-seed configuration for startup. Opting in requires the full `SeedOnInitConfig` (cacheKey, topics).
- `seedOnDemand?: SeedOnDemandConfig<TLink>` — on-demand seeding configuration. Opting in requires the full `SeedOnDemandConfig` (keyTypes, subscribeTopics). Without it, the collection does not support lazy seeding via `client.seed(identity)`.

### 5.4.3 Other optional members

- `idReferences?: readonly IdReference<TLink>[]` — declares paths in this collection's read model data that contain references to aggregate IDs or links. Used by the event processor for overlay event reconciliation when an anticipated create resolves to a server ID. The self-ID at `$.id` is auto-injected by `resolveConfig` from the collection's `aggregate`; consumers declare other references (e.g. `notebookId` on a `Note` pointing at the `Notebook` aggregate). See [0015 §25.2](0015-aggregate-config.md#152-types).
- `revisionPath?: JSONPathExpression` — JSONPath into read model data where the aggregate's stream revision lives. Used to advance `AggregateChain.lastKnownRevision` from server data so subsequent `AutoRevision` commands resolve against the latest confirmed revision.
- `seedPageSize?: number` — page size for seeding (default `100`).

### 5.4.4 Capability methods

These methods are optional on the base interface; their presence is detected at use sites via narrowing types (`CollectionWithFetchStreamEvents`, etc.) and corresponding type guards (`isCollectionWithFetchStreamEvents`).

- `fetchSeedRecords?(opts): Promise<SeedRecordPage>` — primary seeding mechanism; pre-computed read model records go directly into the read model store without event processing.
- `fetchSeedEvents?(opts): Promise<SeedEventPage>` — fallback seeding via events processed through event processors. Only used if `fetchSeedRecords` is undefined.
- `fetchStreamEvents?(opts): Promise<IPersistedEvent[]>` — per-stream event fetch for gap recovery and command response processing. If undefined, gap recovery processes buffered events as-is (lossy).

A seedable collection must implement at least one of `fetchSeedRecords` or `fetchSeedEvents`.

### 5.4.5 Sub-config types

**`SeedOnInitConfig<TLink>`** — required completeness when `seedOnInit` is set:

- `cacheKey: CacheKeyIdentity<TLink>` — the cache key auto-seeded on startup.
- `topics: readonly string[]` — WS topics subscribed on startup for this collection.

**`SeedOnDemandConfig<TLink>`** — required completeness when `seedOnDemand` is set:

- `keyTypes: readonly CacheKeyMatcher<TLink>[]` — cache key shapes that activate this collection for on-demand seeding. When `client.seed(identity)` is called and `identity` matches one of these matchers, this collection is seeded under that cache key.
- `subscribeTopics(cacheKey): string[]` — WS topic patterns to subscribe to for a given cache key, called when the key is acquired (seeded or on-demand). Return `[]` for no subscription.

### 5.4.6 Fetch context

The `FetchContext` passed to fetch methods contains the resolved base URL and headers from `NetworkConfig`.
If `NetworkConfig.getAuthToken` is configured, the resolved token is included as an `Authorization` header.
For cookie-based auth, no special handling is needed — the browser sends cookies automatically with `fetch()`.
Collections may add their own headers (e.g., `Accept-Profile`, `x-tenant-id`) in their fetch implementations.

Collections are **agnostic to cache key eviction policy** (persistent vs ephemeral).

---

## 5.5 Seeding rule (authoritative)

A cache key is considered **seeded** for a collection when:

1. The Sync Manager has paged through the collection until the returned record count is less than the requested page size (the terminator condition; an empty page is a special case).
2. All fetched records have been written to the read model snapshot store.
3. Any collection-level metadata has been persisted.

When all matching collections for a cache key have settled, the Sync Manager emits `CacheSeedSettled` (runtime key: `cache:seed-settled`) with payload `{ cacheKey, status: 'succeeded' | 'failed', collections: Array<{ name, seeded, error? }> }`.

The event is emitted per cache key, not per (cacheKey, collection) — the payload's `collections` array aggregates all matching collections' outcomes. Consumers needing per-collection seed completion read it from there.

---

## 5.6 Permanent event handling (ordering & gap repair)

Permanent events:

- Are de-duplicated by `event.id`

- May arrive out of order

- Must not be applied to the read model until all required stream revisions are available

When a revision gap is detected (either by the Sync Manager observing the gap directly or by a processor refusing to apply an event), the Sync Manager fetches missing events via collection-pluggable per-stream fetchers — `collection.fetchStreamEvents({ ctx, streamId, afterRevision })` on the collection that surfaced the gap. The `GapRepairCoordinator` orchestrates the repair:

1. Fetch missing events for the affected stream.
2. Enqueue the fetched events on the write queue as an `apply-gap-repair` operation.
3. Drain the gap buffer through the reconcile pipeline once repair completes; clear the per-stream "repairing" guard so subsequent WS events can retry on failure.

`sync:gap-detected`, `sync:gap-repair-started`, and `sync:gap-repair-completed` events surface progress.

If the surfacing collection's `fetchStreamEvents` is undefined, gap recovery is invalidated (the gap is not actually closed). Collections that need durable gap repair must implement `fetchStreamEvents` — capability detected at use sites via `isCollectionWithFetchStreamEvents`.

---

## 5.7 Stateful event handling

Stateful events:

- Have no `position`, only `createdAt`

- Are applied best-effort and may be processed immediately

**Stateful handling is work in progress.** The full design will land when a real stateful aggregate enters scope — likely once the toolkit is being used to build an application with one. The current implementation's primary purpose is keeping permanent-event flow consistent and ensuring stateful events do not corrupt the read model; it is **not** the intended end-state for stateful semantics.

What currently exists:

- The `InvalidationScheduler` debounces refetch per `(collection, cacheKey)` pair (default 500 ms), coalescing repeated invalidations within the window.
- Triggers include processor invalidation signals and command-success paths (`event-less-response`, `no-expected-revision`).
- Each scheduled refetch re-executes the collection's seed flow (`fetchSeedRecords` or `fetchSeedEvents`) against current server state. This full re-execution is correctness-first interim behavior — incremental stateful application, dedicated stateful APIs, and related improvements are pending design.

---

## 5.8 Lifecycle, prioritization, and activity awareness

- Sync Manager prioritizes:
  1.  cache keys that are actively held by windows

  2.  recently accessed keys

  3.  frozen keys (on startup resync)

- Keys with active window holds are treated as **non-evictable** for sync purposes.

- Older inactive keys are staggered or deprioritized.

---

## 5.9 User mismatch data wipe (hard reset)

When a session user mismatch is detected:

1.  All sync activity is halted.

2.  The following local data is cleared:

- Cache Manager metadata

- Sync metadata

- Event Cache

- Read Model Store

- Command Queue (all pending, blocked, sending, and failed commands; see [§4.5.3](0004-command-queue.md#453-user-identity-change-handling))

3.  A new persisted session is created.

4.  Sync Manager resumes in paused mode until authentication is confirmed.

If recovery is not possible, the Sync Manager may emit a fatal error recommending a full page reload.

---

## 5.10 Offline-support execution boundary

In offline modes, the Sync Manager runs within the **storage worker** (SharedWorker, Dedicated Worker, or main thread depending on platform):

### 5.10.1 Multi-tab mode (SharedWorker — Mode C)

- The Sync Manager runs in the SharedWorker.

- All tabs share a single Sync Manager instance.

- Window-facing APIs are proxies using MessagePort.

- The Sync Manager (via the SharedWorker) routes SQLite reads and writes to the active tab's DedicatedWorker (see [0001 §1.1.4](0001-modes-and-constraints.md#114-mode-c--shared-worker)). The SharedWorker itself does not touch OPFS or SQLite directly.

- Windows query data via requests to the SharedWorker.

### 5.10.2 Single-tab mode (Dedicated Worker — Mode B)

- The Sync Manager runs in the Dedicated Worker.

- Only one tab may be open (enforced by tab lock).

- Window-facing APIs are proxies using `postMessage`.

- All writes to SQLite are performed by the Dedicated Worker.

- Windows query data via requests to the Dedicated Worker.

### 5.10.3 Online-only mode (Mode A — main thread)

- The Sync Manager runs on the main thread alongside the rest of the execution stack (see [0001 §1.1.8](0001-modes-and-constraints.md#118-execution-stack-topology)).

- No tab lock — multiple tabs may run concurrently, each with its own independent in-memory state.

- All APIs are direct function calls (no message passing).

- No persistent storage — state lives in JS data structures (see [0001 §1.1.1](0001-modes-and-constraints.md#111-mode-a--online-only)).

- Restarts (page reload, hard navigation) reset all client state.

---

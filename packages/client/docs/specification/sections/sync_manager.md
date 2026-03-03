# 4\. Sync Manager (Network & Synchronization Orchestrator)

## 4.1 Purpose

The Sync Manager is the **network-facing orchestration component** responsible for keeping local read model snapshots and event caches up to date for all **active cache keys**, using REST API requests and WebSocket subscriptions (with polling fallback).

It owns:

- when network activity is allowed to occur

- how data is seeded, incrementally updated, repaired, or refetched

- how authentication, connectivity, and offline/online transitions affect synchronization

The Sync Manager **does not expose read state directly**; it produces and updates local state consumed via the Query Manager.

---

## 4.2 Responsibilities

The Sync Manager is responsible for the following:

### 4.2.1 Cache key–driven lifecycle

- Observe Cache Manager events to drive synchronization lifecycle:
  - on `CacheKeyAdded` / `CacheKeyAccessed`:
    - if the key is **active** (held by at least one window), ensure all configured collections for that key are seeded and kept up to date

  - on `CacheKeyEvicted`:
    - immediately stop all network activity for that key

    - unsubscribe from all WebSocket topics for that key

    - cancel in-flight fetches

    - delete key-scoped sync metadata

### 4.2.2 Collection synchronization

For each configured collection associated with an active cache key:

- **Seed**: load the authoritative snapshot via REST pagination

- **Subscribe**: receive incremental updates via WebSocket topics (or polling fallback)

- **Gap repair**: detect missing permanent events and fetch them via REST

- **Stateful invalidation handling**: apply stateful events best-effort or refetch affected collections

### 4.2.3 Event handling & propagation

- Write permanent and stateful events into the Event Cache

- Trigger read model processing by emitting internal “events appended / invalidated” signals

- Ensure ordering guarantees and gap repair requirements are upheld before processors apply events

### 4.2.4 Network gating & session awareness

- Defer, pause, or resume network activity based on:
  - authentication state

  - network availability

  - server reachability (circuit breaker)

- Coordinate with the Connectivity Manager (see §4.3)

---

## 4.3 Connectivity Manager (Sync Manager subcomponent)

The Connectivity Manager is a **subcomponent of the Sync Manager** and is the single authority for determining whether network activity is allowed.

### 4.3.1 Connectivity state

The Connectivity Manager maintains the following derived state:

- `network: 'online' | 'offline' | 'unknown'`

- `serverReachable: 'yes' | 'no' | 'unknown'`

- `auth: 'valid' | 'invalid' | 'unknown'`

- `mode: 'normal' | 'paused' | 'degraded'`

### 4.3.2 Authentication signaling (application-driven)

The application **must explicitly signal authentication state** to the Sync Manager:

- `setAuthenticated({ userId: string })`

- `setUnauthenticated()` (optional)

Rules:

- The Sync Manager **must not initiate any network requests** unless:
  - `auth === 'valid'`

  - `network !== 'offline'`

  - the circuit breaker is closed

- Authentication may be unknown at startup to allow offline-first initialization.

### 4.3.3 Offline-first startup behavior

On application startup:

1.  The Sync Manager loads the last persisted session (if any).

2.  `auth` is set to `'unknown'`.

3.  All network activity is paused.

4.  Existing cached data is made available for querying.

5.  Network activity resumes only after `setAuthenticated` is called.

### 4.3.4 Session user change handling

When `setAuthenticated({ userId })` is called:

- If no prior session exists:
  - create a new persisted session

  - resume network activity

- If prior session exists and `userId` matches:
  - resume network activity

- If prior session exists and `userId` differs:
  - emit `SessionUserMismatchDetected`

  - perform a **full local data wipe** (see §4.9)

  - create a new session for the new user

  - resume network activity

---

## 4.4 Collection configuration model

Each synchronized collection is configured by user code.

Minimum configuration:

- `collectionName: string`

- `keyTypes: ('Scope' | 'Tenant' | 'Workspace' | 'Project' | 'Room')[]` — which cache keys activate this collection

- `buildFilters(cacheKey, params: URLSearchParams): void` — populate collection filters

- `fetchPage(params: URLSearchParams): Promise<{ items: ReadModelRecord[]; nextCursor?: string | null }>`

- `subscribeTopics(cacheKey): string[]` — WS topics to subscribe to for incremental updates

- `applyIncoming(event): void` — route event to Event Cache + processors

- `detectAffectedCollectionsForStateful(event): string[]` — for stateful invalidation/refetch

- `eventsEndpoint: string | (cacheKey, context) => RequestConfig`

The Sync Manager may append request parameters such as:

- `limit`

- `cursor`

- `lastUpdated` (for stateful refetch batching)

Collections are **agnostic to cache key eviction policy** (persistent vs ephemeral).

---

## 4.5 Seeding rule (authoritative)

A cache key is considered **seeded** for a collection when:

1.  The Sync Manager has paged through the collection until:

- the response is empty, OR

- the returned item count is less than the page size

2.  All fetched items have been written to the read model snapshot store

3.  Any collection-level metadata has been persisted

At this point, the Sync Manager emits:

- `CollectionSeedCompleted { cacheKey, collectionName }`

---

## 4.6 Permanent event handling (ordering & gap repair)

Permanent events:

- Are de-duplicated by `event.id`

- May arrive out of order

- Must not be applied to the read model until all required stream revisions are available

If a revision gap is detected (either by the Sync Manager or by a processor refusing to apply an event):

- The Sync Manager must fetch missing events via the configured `eventsEndpoint`

- Fetched events are written to the Event Cache

- Application resumes only after gaps are resolved

---

## 4.7 Stateful event handling

Stateful events:

- Have no `position`, only `createdAt`

- Are applied best-effort and may be processed immediately

If a processor cannot apply a stateful event or signals invalidation:

- The Sync Manager schedules a refetch for the affected `(cacheKey, collection)`

- Refetching is **debounced per (cacheKey, collection)** to prevent request stampedes

- The refetch strategy may use:
  - `lastUpdated >= lastStatefulSeenAt`, or

  - a full snapshot refresh

Support for `lastUpdated` filters is optional and integration-dependent.

---

## 4.8 Lifecycle, prioritization, and activity awareness

- Sync Manager prioritizes:
  1.  cache keys that are actively held by windows

  2.  recently accessed keys

  3.  frozen keys (on startup resync)

- Keys with active window holds are treated as **non-evictable** for sync purposes.

- Older inactive keys are staggered or deprioritized.

---

## 4.9 User mismatch data wipe (hard reset)

When a session user mismatch is detected:

1.  All sync activity is halted.

2.  The following local data is cleared:

- Cache Manager metadata

- Sync metadata

- Event Cache

- Read Model Store

3.  Pending commands remain stored but must not be sent unless explicitly revalidated.

4.  A new persisted session is created.

5.  Sync Manager resumes in paused mode until authentication is confirmed.

If recovery is not possible, the Sync Manager may emit a fatal error recommending a full page reload.

---

## 4.10 Offline-support execution boundary

In offline modes, the Sync Manager runs within the **storage worker** (SharedWorker, Dedicated Worker, or main thread depending on platform):

### 4.10.1 Multi-tab mode (SharedWorker)

- The Sync Manager runs in the SharedWorker.

- All tabs share a single Sync Manager instance.

- Window-facing APIs are proxies using MessagePort.

- All writes to SQLite are performed by the SharedWorker.

- Windows query data via requests to the SharedWorker.

### 4.10.2 Single-tab mode (Dedicated Worker)

- The Sync Manager runs in the Dedicated Worker.

- Only one tab may be open (enforced by tab lock).

- Window-facing APIs are proxies using `postMessage`.

- All writes to SQLite are performed by the Dedicated Worker.

- Windows query data via requests to the Dedicated Worker.

### 4.10.3 Single-tab mode (main thread)

- The Sync Manager runs on the main thread.

- Only one tab may be open (enforced by tab lock).

- All APIs are direct function calls (no message passing).

- All writes to SQLite occur on the main thread.

- **Note:** Long-running queries may briefly block the UI.

---

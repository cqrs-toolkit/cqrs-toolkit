# 4\. Command Queue (Resilient Command Pipeline)

## 4.1 Purpose

The Command Queue is responsible for **persisting, sequencing, retrying, and reconciling commands** issued by the client until they are successfully processed by the server or explicitly resolved.

It enables:

- offline command capture

- optimistic UI updates via anticipated events

- safe retry and resume across reloads, crashes, and connectivity loss

- deterministic reconciliation with authoritative server results

The Command Queue is the **only component** that invokes the Domain Layer to execute commands.

---

## 4.2 Core principles and constraints

### 4.2.1 Read-model independence

Commands:

- must **never depend on local read model data**

- must remain valid even if:
  - no cache keys are loaded

  - all cached data has been evicted

- may be issued while offline or before authentication is confirmed

This ensures:

- cache eviction does not invalidate pending commands

- command correctness is not coupled to UI state or caching decisions

---

### 4.2.2 Persistence and durability

- In offline-support mode, all enqueued commands are persisted.

- Commands survive:
  - page reloads

  - browser restarts

  - offline periods

- In online-only mode, commands are stored in memory only.

---

## 4.3 Responsibilities

The Command Queue is responsible for:

- Persisting commands and execution metadata

- Managing command dependencies and execution order

- Retrying failed commands with backoff

- Producing anticipated events via the Domain Layer

- Writing anticipated events into the Event Cache

- Reconciling anticipated events with server responses

- Emitting command lifecycle events

The Command Queue does **not**:

- read from the Read Model Store

- manage cache keys or eviction

- perform network I/O directly

- infer or manage authentication state

---

## 4.4 Command record schema

Each persisted command record (`CommandRecord<TLink, TCommand, TResponse>`) includes:

**Identity and routing:**

- `commandId: string` — client-generated, stable identifier.
- `cacheKey: CacheKeyIdentity<TLink>` — the cache key that scopes this command's anticipated events and response events. Persisted as JSON in SQL storage.
- `service: string` — target service for the command.
- `type: string` — command type (e.g. `CreateTodo`).
- `data: object` — command payload.
- `path?: unknown` — URL path template values for command-sender URL expansion.

**Lifecycle:**

- `status: 'pending' | 'blocked' | 'sending' | 'succeeded' | 'applied' | 'failed' | 'cancelled'`
  - `'succeeded'` — server confirmed; effects not yet reflected in `serverData`.
  - `'applied'` — pipeline-owned post-terminal state. The sync pipeline transitions `'succeeded'` → `'applied'` after observing either the command's response events or per-aggregate revision/eviction coverage. Terminal-status checks (file cleanup, chain detachment, `waitForSucceeded`) fire at `'succeeded'`; `'applied'` is post-terminal and not part of `TerminalCommandStatus`.
- `attempts: number`
- `lastAttemptAt?: number`
- `error?: IException` — present on failed commands (typed exception from `@meticoeus/ddd-es`).
- `serverResponse?: TResponse` — set on success.

**Dependencies:**

- `dependsOn: string[]` — commandIds this command waits for. Auto-derived from `EntityRef.commandId` values in command data; explicit declarations for entity references are unnecessary (see [0014 §14.6.1](0014-entity-ref.md#1461-automatic-dependson)).
- `blockedBy: string[]` — back-reference to dependents.

**Bookkeeping:**

- `seq: number` — sequence number for stable submit-order sorting. SQL autoincrement is authoritative on disk; the value is read-only from the storage perspective.
- `createdAt: number`
- `updatedAt: number`

### 4.4.1 EntityRef and aggregate integration fields

- `creates?: CreateCommandConfig` — present only for commands that create an aggregate. Carries `{ eventType, idStrategy }` declaring which response event type carries the server-assigned ID and whether the client-generated ID is `'temporary'` or `'permanent'` (see [0014 §14.4](0014-entity-ref.md#144-id-strategy)).
- `affectedAggregates?: AffectedAggregate<TLink>[]` — derived at enqueue time. Each entry carries the canonical `streamId` (chain/concurrency key) and an `EntityId`-aware `TLink` for reconciliation across `EntityRef` lifecycles. See [0015](0015-aggregate-config.md).
- `commandIdPaths?: Record<JSONPathExpression, EntityRef>` — resolved JSONPath positions of `EntityRef` values in the command record, captured at enqueue time. Keyed by JSONPath rooted at the command object (e.g. `$.data.notebookId`, `$.path.id`). Used to strip and restore `EntityRef` values for storage and handler re-runs, derive auto-dependencies from `ref.commandId`, and prune entries as temporary IDs resolve to server IDs (see [0014 §14.5.2](0014-entity-ref.md#1452-command-submission-entityref-extraction-point)).
- `postProcess?: PostProcessPlan` — optional generic post-processing instructions from the domain executor (`{ kind, tempIds? }`). EntityRef-driven field rewriting ([`0014 §14.6.2`](0014-entity-ref.md#1462-automatic-field-rewriting)) and aggregate-config-driven ID reconciliation ([`0015 §15.3`](0015-aggregate-config.md#153-reconciliation)) are auto-wired and do not require explicit `postProcess` entries.

### 4.4.2 Submit-time inputs

- `revision?: string | AutoRevision` — provided by the consumer for mutate commands; absent for creates. `AutoRevision` is a serializable marker the library resolves before send (substituting the read model's current revision, with optional fallback).
- `modelState?: unknown` — read-model snapshot the user had when the command was submitted, captured at submit time and immutable thereafter. Anticipated event handlers receive this as their initial state so the optimistic event reflects what the user saw at submit. The Command Queue does not read the Read Model Store at runtime — this snapshot is consumer-passed at enqueue and persisted with the command record ([§4.3](#43-responsibilities)).

### 4.4.3 File attachments

- `fileRefs?: FileRef[]` — file attachment metadata. At rest, each `FileRef.data` is undefined; the library hydrates `data: Blob` before send. See [§4.14](#414-file-upload-commands) for the full file-upload model.

---

## 4.5 Session and user identity handling

### 4.5.1 Session scoping

- The Command Queue is scoped to the **current session user**.

- At any time, all commands in the queue belong to exactly one user.

- Commands are not shared across sessions.

---

### 4.5.2 Offline-first startup

- The library may initialize with authentication state unknown.

- Commands from the last session (if any) are loaded and retained.

- Commands must **not** be sent to the server until authentication is confirmed.

This allows:

- offline command entry

- inspection of pending commands while offline

---

### 4.5.3 User identity change handling

When the application signals authentication with a `userId` that differs from the persisted session user:

- the library must perform a **full local data wipe**

- this wipe **includes the Command Queue**

- all pending, blocked, or failed commands are deleted

- all associated anticipated events are discarded

- a new empty Command Queue is initialized for the new user

No command from a previous user may be retained or executed.

---

## 4.6 Dependency and post-processing model

### 4.6.1 Dependencies

Commands may declare dependencies via `dependsOn`.
A command may not transition to `sending` until all dependencies have succeeded.

The library auto-populates `dependsOn` from `EntityRef.commandId` values found at the paths declared in the handler's `commandIdReferences` (see [0014 §14.6.1](0014-entity-ref.md#1461-automatic-dependson)).
Consumers do not need to declare `dependsOn` explicitly for cross-command entity references.
Explicit `dependsOn` declarations remain available for non-EntityRef ordering constraints.

---

### 4.6.2 Post-processing

When a command succeeds, the Command Queue reconciles its temporary IDs with the server-assigned IDs and propagates the changes to dependent commands and their anticipated events.

Reconciliation is driven by declarative path metadata on the command handler registration:

- `commandIdReferences` declares JSONPath positions in the command (`$.data.*`, `$.path.*`) where entity IDs appear, paired with the `AggregateConfig` each ID belongs to. The `EntityRef.commandId` on each value identifies the producing create command, which feeds both auto-`dependsOn` ([§4.6.1](#461-dependencies)) and field rewriting on reconcile.
- `responseIdReferences` declares JSONPath positions in the server response where server-assigned IDs appear, paired with the same `AggregateConfig`. The library walks both sides, builds a `clientId → serverId` map, and rewrites pending command data and anticipated events accordingly. When neither `responseIdReferences` nor `responseIdMapping` is provided and the registration names a primary `aggregate`, the library auto-populates `responseIdReferences` with `[{ aggregate, path: '$.id', revisionPath: '$.nextExpectedRevision' }]`.
- `responseIdMapping?(ctx)` is a callback alternative for computing the mapping from arbitrary response shapes (computed ids, response events, multi-step logic).

See [0014 §14.6.2](0014-entity-ref.md#1462-automatic-field-rewriting) and [0015 §15.3](0015-aggregate-config.md#153-reconciliation).

The generic `postProcess?: PostProcessPlan` field on the command record ([§4.4.1](#441-entityref-and-aggregate-integration-fields)) is reserved for non-aggregate post-processing concerns; EntityRef and aggregate-driven reconciliation does not require explicit `postProcess` entries.

Reconciliation must be deterministic and idempotent.

---

## 4.7 Anticipated event handling

- Anticipated events are produced by executing the Domain Layer.

- They:
  - match server event **type names and overall payload shape**, with one exception: ID fields referencing locally-created entities may carry `EntityRef` values per [0014 §14.5.1](0014-entity-ref.md#1451-entityref-in-anticipated-events), where server-originated events always carry plain strings

  - omit server-only fields (e.g., `position`)

  - are associated with a `commandId`

- Anticipated events are written to the Event Cache and applied wherever relevant cached data exists.

Anticipated events:

- may affect currently cached data

- may affect data loaded later

- remain valid regardless of cache eviction

When a command succeeds or is cancelled, the Command Queue is responsible for ensuring associated anticipated events are removed or rebased.

---

## 4.8 Retry and backoff policy

- Retry policy is implementation-defined.

- Recommended behavior:
  - exponential backoff with jitter

  - bounded retries for transient failures

- Commands requiring user intervention must not be retried automatically.

- Dependency ordering must always be preserved.

---

## 4.9 Reconciliation with server results

The Command Queue reconciles each succeeded command against its server response by walking declarative path metadata on the handler registration ([§4.6.2](#462-post-processing)).

The reconciliation pass:

1. Reads the command response and resolves server-assigned ID(s) at paths declared by `responseIdReferences`, or via the `responseIdMapping` callback when provided.
2. Builds a per-aggregate `idMap` of `{ clientId → { serverId, nextExpectedRevision? } }`.
3. Walks each pending command's `commandIdReferences` paths, replacing matching client IDs with server IDs in the command data.
4. Updates the cache key system ([`0003 §3.2.4`](0003-cache-manager.md#324-entityref-driven-inputs-and-reconciliation)) with the same ID mappings so cache key identities reconcile and `CacheKeyReconciled` events fire.
5. Regenerates anticipated events for affected commands by re-running their handlers with the rewritten data.
6. Discards the original anticipated events; the regenerated events flow through the Event Cache → read model in their place.

Each aggregate's `lastKnownRevision` is updated from the response's revision path so subsequent operations see consistent revision tracking.

When the consumer's response shape doesn't expose IDs at predictable paths, `responseIdMapping` provides the escape hatch — it returns explicit `{ clientId: EntityRef; serverId: string; nextExpectedRevision? }` entries.

---

## 4.10 Interaction with cache eviction

- Cache eviction **never deletes or cancels commands**.

- Commands remain valid regardless of which cache keys are currently resident.

**Exception:** a user identity change triggers a full local data wipe, which includes the Command Queue (see [§4.5.3](#453-user-identity-change-handling)).

---

## 4.11 Optional command-driven cache behavior (configurable)

The Command Queue may be configured with an optional callback:

`onCommandEnqueued(command) -> { touchKeys?: CacheKeySpec[]; freezeKeys?: CacheKeySpec[] } | null`

This allows applications to:

- automatically load data needed to observe command effects

- optionally freeze relevant cache keys while commands are pending

This behavior is optional and not required for correctness.

---

## 4.12 Events

The Command Queue emits the following events.
TypeScript event type names below; runtime keys are kebab-case under the `command:` and `commandqueue:` namespaces and map mechanically except where called out.

- `CommandEnqueued`

- `CommandStatusChanged`

- `CommandCompleted` — emitted on success.

- `CommandFailed`

- `CommandCancelled`

- `CommandSent` — emitted when a command is dispatched to the server (after dependencies are satisfied, before the response arrives).

- `CommandResponse` — emitted when a server response arrives for a sent command.

- `CommandQueuePaused` *(runtime key: `commandqueue:paused` — namespace is `commandqueue:`, not `command:`)*

- `CommandQueueResumed` *(runtime key: `commandqueue:resumed` — namespace is `commandqueue:`, not `command:`)*

These events are informational; consumers needing current command state should query it directly.

The terminal event types `CommandCompleted` / `CommandFailed` / `CommandCancelled` fire **after** post-processing completes (id reconciliation, dependent unblocking, anticipated event cleanup).
A `CommandStatusChanged` event whose `status` is terminal fires at the status flip — **before** post-processing.
Consumers that need to observe fully-settled state (e.g. `waitForSucceeded`) should subscribe to the terminal event types, not the status change.

---

## 4.13 Failure and recovery guarantees

The Command Queue must ensure:

- no command is lost once persisted (within a session)

- retries resume correctly after reloads or crashes

- partial failures do not corrupt command state

- anticipated events are cleaned up deterministically

- session changes result in a complete reset with no cross-user leakage

---

## 4.14 File upload commands

The Command Queue natively supports commands that include file uploads.

### 4.14.1 File storage model

Files attached to commands are stored **separately from the command record**:

- The command record in SQLite stores `fileRefs: FileRef[]` — metadata and storage-path references for each attached file ([§4.14.2](#4142-fileref-schema)).
- The actual file bytes are stored via an `ICommandFileStore` abstraction with three first-party implementations:
  - **OPFS** (Mode B and C, browser) — `OpfsCommandFileStore`. Window context writes via the async OPFS API before the command is enqueued; the worker reads when executing. Files persist across page reloads and browser restarts.
  - **In-memory** (Mode A, browser online-only) — `InMemoryCommandFileStore`. Held as `Blob` references in a runtime map. Not persisted; lost on reload, which is acceptable since Mode A makes no persistence guarantees.
  - **`node:fs`** (Electron) — `FsCommandFileStore` in `@cqrs-toolkit/client-electron`, writing to the OS filesystem inside the utility process. Browser-side renderer windows reach the store through `ElectronCommandFileStore` (IPC bridge to the utility process). Files persist across app restarts.

The abstraction is deliberate: each runtime environment provides the file store implementation appropriate to its persistence and IPC model, and downstream code (Command Queue, command sender) operates against the interface uniformly.

This separation ensures SQLite remains fast (no large blobs in the database), and that files can be cleaned up independently of command records.

### 4.14.2 FileRef schema

```ts
interface FileRef {
  id: string         // Unique file identifier (UUID) — used for the storage path and per-file operations
  filename: string   // Original filename
  mimeType: string   // MIME type
  sizeBytes: number  // File size in bytes
  storagePath: string // Path from the storage root (e.g. `cqrs-client/uploads/{commandId}/{fileId}` for OPFS)
  checksum?: string  // Optional integrity check (e.g. SHA-256 hex)
  data?: Blob        // Hydrated by the library before send(); undefined at rest
}
```

`FileRef` is persisted in SQLite in Mode B/C with `data` undefined; the library hydrates `data` from the active file store before passing the command to the sender.
In Mode A, `FileRef` is held in memory alongside the command and `data` is populated directly with the consumer-provided `File`/`Blob`.

### 4.14.3 OPFS file storage (Mode B and C)

The window context is responsible for writing files to OPFS **before** enqueuing the command.
The async OPFS API (`navigator.storage.getDirectory()`, `getFileHandle()`, `createWritable()`) is available on the main thread and is used for this write.

**Path scheme.** OPFS layout: `/cqrs-client/uploads/{commandId}/{fileId}`. `FileRef.storagePath` stores this relative to the storage root (i.e. `cqrs-client/uploads/{commandId}/{fileId}` — no leading slash).

The worker never writes to the uploads directory.
It reads files from OPFS by path (using `getFileHandle()` from `navigator.storage.getDirectory()`) when executing or retrying the upload command.

**Lifecycle:**

1. Window writes file bytes to OPFS path, obtains the path string.
2. Window enqueues command with `fileRefs` referencing the OPFS path.
3. If command enqueue fails after the file has been written, the file is orphaned — see [§4.14.5](#4145-orphan-cleanup) (orphan cleanup).
4. Worker reads file from OPFS path when executing the upload.
5. **Files are deleted when their owning command is deleted.** Command deletion is the single cleanup trigger, regardless of the reason for deletion (success, failure, cancellation, session reset, or debug mode expiry). There are no separate per-outcome cleanup rules.

### 4.14.4 In-memory file storage (Mode A)

In online-only mode, files are held as `Blob` references directly in the in-memory command record.
No OPFS write occurs.
Files are lost on page reload, which is acceptable — Mode A makes no persistence guarantees and upload commands are expected to complete within the session.

There is no `storagePath` in Mode A file references.
The command payload carries the blob directly.

### 4.14.5 Orphan cleanup

An orphaned file is a file present in the file store with no corresponding command record in SQLite.
Orphans can occur if:

- The window staged a file but the subsequent command enqueue failed.
- A crash occurred between the file write and the SQLite commit.

The `ICommandFileStore` interface exposes orphan-cleanup capability; on library startup, after SQLite is initialized, the Command Queue invokes it with the current set of valid command IDs and the file store deletes any files whose owning command no longer exists.

### 4.14.6 Upload execution

The Command Queue does not own upload execution and is deliberately free of upload conventions.
Its responsibility ends at hydrating `FileRef.data` with a Blob (read via the active `ICommandFileStore` implementation — see [§4.14.1](#4141-file-storage-model)) and passing the command — including its hydrated `fileRefs` — to the consumer-injected command sender, which decides how to transmit the file content.

This separation keeps `@cqrs-toolkit/client` agnostic to upload conventions (direct multipart, S3 presigned, custom transports, etc.).
Convention-bearing implementations live one layer up:

- `@cqrs-toolkit/hypermedia-client` auto-wires upload behavior when the server's Hydra documentation declares a workflow the toolkit recognizes — consumers using the hypermedia command sender need no upload boilerplate. The first-party `svc:PresignedPostUpload` convention (S3 presigned form upload) is wired in by default; future conventions slot in alongside it.
- Consumers not using hypermedia-client (or whose server doesn't follow the conventions) implement upload directly in their command sender, working from the hydrated `fileRefs` on each command.

In all cases, the active upload behavior is whatever the consumer's command sender does with the hydrated `fileRefs` — the Command Queue does not enumerate or select among approaches.

### 4.14.7 File store write failure

If a file store write fails when staging a file (quota exceeded, permission error, disk full, or any other reason):

- The command enqueue is rejected with an appropriate error.
- No partial state is written — if the file write fails, the command is never submitted to the worker.
- The library emits a storage error event the host application can handle (e.g. to inform the user).

There is no per-file fallback between file store backends.
The active backend is determined at startup by the runtime environment (see [§4.14.1](#4141-file-storage-model)); silent per-file fallback would produce inconsistent state across the command queue and is not supported.

---

### 4.14.8 File persistence guarantees

The library supports two levels of file persistence guarantee.
The weak guarantee is the current implementation target.
The strong guarantee is deferred pending server protocol definition.

---

#### Weak guarantee (current implementation)

**File lifetime matches command lifetime exactly.**

A file exists in OPFS for as long as its owning command exists in SQLite.
The file is deleted when the command is deleted, for any reason.
The library makes no attempt to associate the local file with the resulting server asset or read model record.

This guarantee is unconditional — it requires no server contract and no event correlation.
In debug mode, where commands are retained after success rather than immediately deleted, files are retained for the same duration automatically.

The UI may display the local OPFS file as a preview while the command is pending (the file is guaranteed to exist for the lifetime of the command). Once the command is deleted and the server URL is available in the read model, the UI transitions to the server URL. There is no library-managed handoff between the two — the transition is a natural consequence of command deletion and read model hydration.

---

#### Strong guarantee (deferred — requires server protocol)

**Local file is served from OPFS as the canonical source for the read model record, for as long as it exists locally, without requiring a re-download.**

This eliminates the need for the user to re-download a file they just uploaded, even after the command has been processed and the read model has been hydrated with the server asset. This is particularly valuable for users on slow or intermittent connections who should never pay the cost of downloading content they just uploaded.

This association is non-trivial under the S3 presigned upload model, where the upload path is:

```
Client upload → S3 → S3 event → Server processing → Server event → Client event → Read model
```

The `commandId` must be propagated through this entire chain to allow the library to close the loop.
This is achievable because the monorepo server utilities own the server contract — `commandId` propagation through confirmation events is a library protocol requirement that server utilities will fulfill automatically. Consumers do not need to implement this manually.

**Required server protocol (to be defined):**

- The presign request must carry the `commandId`.
- The server must persist the `commandId` alongside the asset record.
- The confirmation event delivered to the client must include the original `commandId`.
- The library matches the incoming event to the pending command by `commandId` and establishes the association between the OPFS file and the resulting asset ID in the read model.

**Read model integration under strong guarantee:**

Once the association is established, the library annotates the read model record for the asset with a local file reference.
When the read model is queried, the library resolves asset URLs with the following priority:

1. Local OPFS file (if the originating command still exists and the file is present)
2. Server URL (CDN or direct)

This resolution is transparent to the UI — the query interface returns a resolved URL regardless of source.
The local file serves as an instant-load cache that degrades gracefully to the server URL as the command is eventually cleaned up.

**Implementation note:**

The strong guarantee will be designed and implemented once the server protocol for `commandId` propagation is finalized.
The weak guarantee implementation must not preclude upgrading to the strong guarantee.
Specifically, the `FileRef` schema, OPFS path scheme, and command lifecycle hooks should be designed with the upgrade path in mind — the strong guarantee adds association and read model annotation on top of the existing file lifecycle, it does not replace it.

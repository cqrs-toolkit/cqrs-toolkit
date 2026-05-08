# 3\. Command Queue (Resilient Command Pipeline)

## 3.1 Purpose

The Command Queue is responsible for **persisting, sequencing, retrying, and reconciling commands** issued by the client until they are successfully processed by the server or explicitly resolved.

It enables:

- offline command capture

- optimistic UI updates via anticipated events

- safe retry and resume across reloads, crashes, and connectivity loss

- deterministic reconciliation with authoritative server results

The Command Queue is the **only component** that invokes the Domain Layer to execute commands.

---

## 3.2 Core principles and constraints

### 3.2.1 Read-model independence

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

### 3.2.2 Persistence and durability

- In offline-support mode, all enqueued commands are persisted.

- Commands survive:
  - page reloads

  - browser restarts

  - offline periods

- In online-only mode, commands are stored in memory only.

---

## 3.3 Responsibilities

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

## 3.4 Command record schema

Each persisted command record includes at least:

- `commandId: string`  
  Client-generated, stable identifier.

- `service: string`

- `type: string`

- `payload: object`

- `createdAt: number`

- `status: 'pending' | 'blocked' | 'sending' | 'succeeded' | 'failed' | 'cancelled'`

- `dependsOn: string[]`

- `blockedBy: string[]`

- `attempts: number`

- `lastAttemptAt?: number`

- `error?: { code?: string; message: string; details?: any }`

- `resolution?: { kind: 'none' | 'user_action_required' | 'auto_retry' | string }`

### 3.4.1 Integration fields

- `anticipatedEventIds: string[]`

- `postProcess?: { kind: string; ... }`

- `tempIdHints?: object`

---

## 3.5 Session and user identity handling

### 3.5.1 Session scoping

- The Command Queue is scoped to the **current session user**.

- At any time, all commands in the queue belong to exactly one user.

- Commands are not shared across sessions.

---

### 3.5.2 Offline-first startup

- The library may initialize with authentication state unknown.

- Commands from the last session (if any) are loaded and retained.

- Commands must **not** be sent to the server until authentication is confirmed.

This allows:

- offline command entry

- inspection of pending commands while offline

---

### 3.5.3 User identity change handling

When the application signals authentication with a `userId` that differs from the persisted session user:

- the library must perform a **full local data wipe**

- this wipe **includes the Command Queue**

- all pending, blocked, or failed commands are deleted

- all associated anticipated events are discarded

- a new empty Command Queue is initialized for the new user

No command from a previous user may be retained or executed.

---

## 3.6 Dependency and post-processing model

### 3.6.1 Dependencies

- Commands may declare dependencies via `dependsOn`.

- A command may not transition to `sending` until all dependencies have succeeded.

---

### 3.6.2 Post-processing

When a command succeeds, dependent commands may require transformation:

`postProcess(parentCommands, parentResponses, childCommand) -> updatedChildCommand`

Typical uses include:

- replacing temporary IDs with server-assigned IDs

- rewriting payload references

- updating anticipated events

Post-processing must be deterministic and idempotent.

---

## 3.7 Anticipated event handling

- Anticipated events are produced by executing the Domain Layer.

- They:
  - match server event type names and payload shapes

  - omit server-only fields (e.g., `position`)

  - are associated with a `commandId`

- Anticipated events are written to the Event Cache and applied wherever relevant cached data exists.

Anticipated events:

- may affect currently cached data

- may affect data loaded later

- remain valid regardless of cache eviction

When a command succeeds or is cancelled, the Command Queue is responsible for ensuring associated anticipated events are removed or rebased.

---

## 3.8 Retry and backoff policy

- Retry policy is implementation-defined.

- Recommended behavior:
  - exponential backoff with jitter

  - bounded retries for transient failures

- Commands requiring user intervention must not be retried automatically.

- Dependency ordering must always be preserved.

---

## 3.9 Reconciliation with server results

The Command Queue requires a deterministic mapping between commands and server-produced events.

Supported strategies include:

- server responses include produced event IDs

- server responses include produced events directly

- server guarantees `commandId` propagation onto events

Until such guarantees are standardized:

- reconciliation may fall back to refetching authoritative read models

- anticipated events must be discarded once authoritative state is known

---

## 3.10 Interaction with cache eviction

- Cache eviction **never deletes or cancels commands**.

- Commands remain valid regardless of which cache keys are currently resident.

**Exception:** a user identity change triggers a full local data wipe, which includes the Command Queue (see §3.5.3).

---

## 3.11 Optional command-driven cache behavior (configurable)

The Command Queue may be configured with an optional callback:

`onCommandEnqueued(command) -> { touchKeys?: CacheKeySpec[]; freezeKeys?: CacheKeySpec[] } | null`

This allows applications to:

- automatically load data needed to observe command effects

- optionally freeze relevant cache keys while commands are pending

This behavior is optional and not required for correctness.

---

## 3.12 Events

The Command Queue emits the following events:

- `CommandEnqueued`

- `CommandStatusChanged`

- `CommandSucceeded`

- `CommandFailed`

- `CommandCancelled`

These events are informational only; consumers must query current command state directly.

---

## 3.13 Failure and recovery guarantees

The Command Queue must ensure:

- no command is lost once persisted (within a session)

- retries resume correctly after reloads or crashes

- partial failures do not corrupt command state

- anticipated events are cleaned up deterministically

- session changes result in a complete reset with no cross-user leakage

---

## 3.14 File upload commands

The Command Queue natively supports commands that include file uploads.

### 3.14.1 File storage model

Files attached to commands are stored **separately from the command record**:

- The command record in SQLite stores a `fileRefs: FileRef[]` — metadata and OPFS path references for each attached file.
- The actual file bytes are stored in:
  - **OPFS** (Mode B and C) — written by the window context using the async OPFS API before the command is enqueued. Files persist across page reloads and browser restarts.
  - **In-memory** (Mode A / online-only) — files are held as `Blob` references in the command payload. Not persisted. Lost on reload, which is acceptable since Mode A makes no persistence guarantees.

This separation ensures SQLite remains fast (no large blobs in the database), and that files can be cleaned up independently of command records.

### 3.14.2 FileRef schema

```ts
interface FileRef {
  id: string // Unique file identifier (e.g. uuid)
  commandId: string // Owning command
  filename: string // Original filename
  mimeType: string // MIME type
  sizeBytes: number // File size in bytes
  checksum?: string // Optional integrity check (e.g. SHA-256 hex)
  storagePath: string // OPFS path — e.g. /cqrs-client/uploads/{commandId}/{fileId}
  createdAt: number // Unix timestamp ms
}
```

`FileRef` is only persisted in SQLite in Mode B/C.
In Mode A, file references are held in memory alongside the command and carry no `storagePath`.

### 3.14.3 OPFS file storage (Mode B and C)

The window context is responsible for writing files to OPFS **before** enqueuing the command.
The async OPFS API (`navigator.storage.getDirectory()`, `getFileHandle()`, `createWritable()`) is available on the main thread and is used for this write.

Path scheme: `/cqrs-client/uploads/{commandId}/{fileId}`

The worker never writes to the uploads directory.
It reads files from OPFS by path (using `getFileHandle()` from `navigator.storage.getDirectory()`) when executing or retrying the upload command.

**Lifecycle:**

1. Window writes file bytes to OPFS path, obtains the path string.
2. Window enqueues command with `fileRefs` referencing the OPFS path.
3. If command enqueue fails after the file has been written, the file is orphaned — see §3.14.5 (orphan cleanup).
4. Worker reads file from OPFS path when executing the upload.
5. **Files are deleted when their owning command is deleted.** Command deletion is the single cleanup trigger, regardless of the reason for deletion (success, failure, cancellation, session reset, or debug mode expiry). There are no separate per-outcome cleanup rules.

### 3.14.4 In-memory file storage (Mode A)

In online-only mode, files are held as `Blob` references directly in the in-memory command record.
No OPFS write occurs.
Files are lost on page reload, which is acceptable — Mode A makes no persistence guarantees and upload commands are expected to complete within the session.

There is no `storagePath` in Mode A file references.
The command payload carries the blob directly.

### 3.14.5 Orphan cleanup

An orphaned file is a file present in `/cqrs-client/uploads/` with no corresponding command record in SQLite.
Orphans can occur if:

- The window wrote a file to OPFS but the subsequent command enqueue failed.
- A crash occurred between the file write and the SQLite commit.

On library startup (Mode B/C), the library must scan `/cqrs-client/uploads/` and delete any files whose `commandId` path segment does not correspond to an existing command record in SQLite.
This scan is performed by the worker after SQLite is initialized.

### 3.14.6 Upload strategies

File upload execution is delegated to a consumer-configured upload strategy.
The library provides two first-party strategies:

**Direct API upload**

The library POSTs the file directly to a consumer-configured endpoint.

```ts
interface DirectUploadStrategy {
  type: 'direct'
  url: string | ((command: Command) => string)
  headers?: Record<string, string> | ((command: Command) => Record<string, string>)
}
```

**S3 presigned upload**

The library fetches a presigned URL or presigned form fields from a consumer-configured endpoint, then uploads the file directly to S3 (or compatible storage).

```ts
interface S3PresignedUploadStrategy {
  type: 's3-presigned'
  presignEndpoint: string | ((command: Command) => string)
  // Library fetches presign response, then POSTs directly to S3
}
```

The active strategy is provided at library initialization and applies to all file upload commands.
The library passes the file — either read from OPFS by path or from the in-memory blob — to the strategy implementation. The strategy is not aware of how the file was stored.

### 3.14.7 OPFS write failure

If the OPFS write fails when the window attempts to stage a file (quota exceeded, permission error, or any other reason):

- The command enqueue is rejected with an appropriate error.
- No partial state is written — if the file write fails, the command is never submitted to the worker.
- The library emits a storage error event the host application can handle (e.g. to inform the user).

There is no per-file fallback from OPFS to in-memory in worker modes.
The storage backend is determined at startup by mode selection.
Silent per-file fallback would produce inconsistent state across the command queue and is not supported.

---

### 3.14.8 File persistence guarantees

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

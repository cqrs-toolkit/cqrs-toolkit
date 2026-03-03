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

- The command record in SQLite stores:
  - `fileHandles: FileHandle[]` — references to stored files
  - File metadata (name, size, MIME type, checksum)

- The actual file bytes are stored in:
  - **OPFS** (when available) — preferred for offline modes
  - **In-memory** (online-only mode) — files held as `Blob` or `ArrayBuffer`

This separation ensures:

- SQLite remains fast (no large blobs in the database)
- Files survive page reloads in offline modes
- Files can be cleaned up independently of command records

### 3.14.2 FileHandle schema

```ts
interface FileHandle {
  id: string // Unique file identifier
  commandId: string // Owning command
  filename: string // Original filename
  mimeType: string // MIME type
  sizeBytes: number // File size
  checksum?: string // Optional integrity check (e.g., SHA-256)
  storagePath: string // OPFS path or in-memory key
  storageType: 'opfs' | 'memory'
  createdAt: number
}
```

### 3.14.3 OPFS file storage

When OPFS is available (offline modes):

- Files are written to OPFS under a dedicated directory (e.g., `/cqrs-client/uploads/`)
- File path: `/{commandId}/{fileId}` or similar structure
- Files persist across page reloads and browser restarts
- On command success: files may be deleted or retained based on configuration
- On command failure/cancellation: files are deleted
- On session reset: all files are deleted

### 3.14.4 In-memory file storage

When OPFS is not available (online-only mode):

- Files are held in memory as `Blob` or `ArrayBuffer`
- A `Map<string, Blob>` or similar structure maintains file references
- Files are lost on page reload (acceptable for online-only mode)
- Memory pressure may require limiting total file size

### 3.14.5 File lifecycle

1. **Attachment**: When a command with files is enqueued:
   - Files are immediately written to OPFS (or memory)
   - FileHandles are created and stored with the command
   - Command payload references files by handle ID

2. **Upload**: When the command is sent:
   - Files are read from storage and included in the request
   - Upload progress may be tracked per-file

3. **Completion**: When the command succeeds:
   - Files may be deleted immediately, or
   - Retained temporarily for retry scenarios, then cleaned up

4. **Failure/Cancellation**:
   - Files are deleted when the command is resolved

5. **Session reset**:
   - All files are deleted along with command data

### 3.14.6 Fallback behavior

If OPFS write fails (quota exceeded, permission denied):

- Attempt to fall back to in-memory storage
- If memory storage also fails, reject the command enqueue
- Emit appropriate error event

---

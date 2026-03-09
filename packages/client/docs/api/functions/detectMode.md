[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / detectMode

# Function: detectMode()

> **detectMode**(): [`ExecutionMode`](../type-aliases/ExecutionMode.md)

Detect the best execution mode for the current browser environment.

Stage 1 checks:

- `navigator.storage.getDirectory` exists (OPFS entry point)
- `navigator.locks` exists (Web Locks API, required for tab coordination)

Note: `createSyncAccessHandle` is NOT checked here — some browsers don't
expose it on the main-thread prototype even though it works inside workers.
The authoritative check runs inside the worker via the Stage 2 OPFS probe.

## Returns

[`ExecutionMode`](../type-aliases/ExecutionMode.md)

The most capable execution mode available

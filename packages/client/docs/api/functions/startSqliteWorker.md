[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / startSqliteWorker

# Function: startSqliteWorker()

> **startSqliteWorker**(): `void`

Defined in: [packages/client/src/adapters/worker-core/sqlite-worker/startSqliteWorker.ts:36](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/adapters/worker-core/sqlite-worker/startSqliteWorker.ts#L36)

Bootstrap the SQLite worker.

Listens for probe/routing-port setup messages on self.onmessage,
and handles SQLite init/exec/close on the routing port (Mode C)
or directly on self.onmessage (Mode B fallback).

## Returns

`void`

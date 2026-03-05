[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / startSqliteWorker

# Function: startSqliteWorker()

> **startSqliteWorker**(): `void`

Defined in: packages/client/src/adapters/worker-core/sqlite-worker/startSqliteWorker.ts:27

Bootstrap the child sqlite worker.

Listens for init/exec/close messages from the parent SharedWorker
and delegates to the local SQLite WASM database.

## Returns

`void`

[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / startSqliteWorker

# Function: startSqliteWorker()

> **startSqliteWorker**(): `void`

Bootstrap the SQLite worker.

Listens for probe/routing-port setup messages on self.onmessage,
and handles SQLite init/exec/close on the routing port (Mode C)
or directly on self.onmessage (Mode B fallback).

## Returns

`void`

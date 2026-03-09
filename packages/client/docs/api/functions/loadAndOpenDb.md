[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / loadAndOpenDb

# Function: loadAndOpenDb()

> **loadAndOpenDb**(`config`): `Promise`\<[`LocalSqliteDb`](../classes/LocalSqliteDb.md)\>

Load the SQLite WASM module and open a database.

This is the single place that touches `@sqlite.org/sqlite-wasm`.
Both Mode C (locally in the DedicatedWorker) and Mode B (in the
child sqlite worker) call this function.

## Parameters

### config

[`LoadAndOpenDbConfig`](../interfaces/LoadAndOpenDbConfig.md)

## Returns

`Promise`\<[`LocalSqliteDb`](../classes/LocalSqliteDb.md)\>

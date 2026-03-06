[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / loadAndOpenDb

# Function: loadAndOpenDb()

> **loadAndOpenDb**(`config`): `Promise`\<[`LocalSqliteDb`](../classes/LocalSqliteDb.md)\>

Defined in: [packages/client/src/storage/LocalSqliteDb.ts:77](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/LocalSqliteDb.ts#L77)

Load the SQLite WASM module and open a database.

This is the single place that touches `@sqlite.org/sqlite-wasm`.
Both Mode C (locally in the DedicatedWorker) and Mode B (in the
child sqlite worker) call this function.

## Parameters

### config

[`LoadAndOpenDbConfig`](../interfaces/LoadAndOpenDbConfig.md)

## Returns

`Promise`\<[`LocalSqliteDb`](../classes/LocalSqliteDb.md)\>

[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / LocalSqliteDb

# Class: LocalSqliteDb

Thin async wrapper around the synchronous WASM SQLite database.

Implements `ISqliteDb` so SQLiteStorage can use it interchangeably
with `RemoteSqliteDb`.

## Implements

- [`ISqliteDb`](../interfaces/ISqliteDb.md)

## Constructors

### Constructor

> **new LocalSqliteDb**(`rawDb`): `LocalSqliteDb`

#### Parameters

##### rawDb

`RawSqliteDb`

#### Returns

`LocalSqliteDb`

## Methods

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ISqliteDb`](../interfaces/ISqliteDb.md).[`close`](../interfaces/ISqliteDb.md#close)

---

### exec()

#### Call Signature

> **exec**\<`T`\>(`sql`, `options`): `Promise`\<`T`[]\>

##### Type Parameters

###### T

`T` = `Record`\<`string`, `unknown`\>

##### Parameters

###### sql

`string`

###### options

###### bind?

`unknown`[]

###### returnValue

`"resultRows"`

###### rowMode

`"object"`

##### Returns

`Promise`\<`T`[]\>

##### Implementation of

[`ISqliteDb`](../interfaces/ISqliteDb.md).[`exec`](../interfaces/ISqliteDb.md#exec)

#### Call Signature

> **exec**(`sql`, `options?`): `Promise`\<`void`\>

##### Parameters

###### sql

`string`

###### options?

###### bind?

`unknown`[]

##### Returns

`Promise`\<`void`\>

##### Implementation of

[`ISqliteDb`](../interfaces/ISqliteDb.md).[`exec`](../interfaces/ISqliteDb.md#exec)

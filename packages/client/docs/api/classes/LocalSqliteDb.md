[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / LocalSqliteDb

# Class: LocalSqliteDb

Defined in: [packages/client/src/storage/LocalSqliteDb.ts:91](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/storage/LocalSqliteDb.ts#L91)

Thin async wrapper around the synchronous WASM SQLite database.

Implements `ISqliteDb` so SQLiteStorage can use it interchangeably
with `RemoteSqliteDb`.

## Implements

- [`ISqliteDb`](../interfaces/ISqliteDb.md)

## Constructors

### Constructor

> **new LocalSqliteDb**(`rawDb`): `LocalSqliteDb`

Defined in: [packages/client/src/storage/LocalSqliteDb.ts:94](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/storage/LocalSqliteDb.ts#L94)

#### Parameters

##### rawDb

`RawSqliteDb`

#### Returns

`LocalSqliteDb`

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: [packages/client/src/storage/LocalSqliteDb.ts:118](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/storage/LocalSqliteDb.ts#L118)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ISqliteDb`](../interfaces/ISqliteDb.md).[`close`](../interfaces/ISqliteDb.md#close)

---

### exec()

#### Call Signature

> **exec**\<`T`\>(`sql`, `options`): `Promise`\<`T`[]\>

Defined in: [packages/client/src/storage/LocalSqliteDb.ts:98](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/storage/LocalSqliteDb.ts#L98)

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

Defined in: [packages/client/src/storage/LocalSqliteDb.ts:102](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/storage/LocalSqliteDb.ts#L102)

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

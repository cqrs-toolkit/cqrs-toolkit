[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ISqliteDb

# Interface: ISqliteDb

Defined in: [packages/client/src/storage/ISqliteDb.ts:20](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/ISqliteDb.ts#L20)

Async SQLite database interface.

The generic on the query overload declares the row shape we expect back.
Since we control the schema through migrations and SQLite enforces column
types, the row type parameter is a sound declaration of what we know we're
getting — not a speculative cast.

## Methods

### close()

> **close**(): `Promise`\<`void`\>

Defined in: [packages/client/src/storage/ISqliteDb.ts:26](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/ISqliteDb.ts#L26)

#### Returns

`Promise`\<`void`\>

---

### exec()

#### Call Signature

> **exec**\<`T`\>(`sql`, `options`): `Promise`\<`T`[]\>

Defined in: [packages/client/src/storage/ISqliteDb.ts:21](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/ISqliteDb.ts#L21)

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

#### Call Signature

> **exec**(`sql`, `options?`): `Promise`\<`void`\>

Defined in: [packages/client/src/storage/ISqliteDb.ts:25](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/storage/ISqliteDb.ts#L25)

##### Parameters

###### sql

`string`

###### options?

###### bind?

`unknown`[]

##### Returns

`Promise`\<`void`\>

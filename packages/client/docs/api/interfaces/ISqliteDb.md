[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ISqliteDb

# Interface: ISqliteDb

Async SQLite database interface.

The generic on the query overload declares the row shape we expect back.
Since we control the schema through migrations and SQLite enforces column
types, the row type parameter is a sound declaration of what we know we're
getting — not a speculative cast.

## Methods

### close()

> **close**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

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

---

### execBatch()

> **execBatch**\<`T`\>(`statements`): `Promise`\<`BatchResult`\<`T`\>\>

Execute multiple statements inside a single transaction.

The entire batch is wrapped in BEGIN / COMMIT. On failure the
transaction is rolled back and the error is rethrown.

Returns one result slot per input statement in the same order:

- `undefined` when `returnRows` was false/omitted
- the row-object array when `returnRows` was true

#### Type Parameters

##### T

`T` _extends_ readonly `SqliteBatchStatement`\<`any`\>[]

#### Parameters

##### statements

`T`

#### Returns

`Promise`\<`BatchResult`\<`T`\>\>

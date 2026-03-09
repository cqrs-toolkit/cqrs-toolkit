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

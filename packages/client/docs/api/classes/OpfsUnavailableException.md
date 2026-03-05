[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / OpfsUnavailableException

# Class: OpfsUnavailableException

Defined in: packages/client/src/adapters/worker-core/probeOpfs.ts:18

OPFS is not available in this worker environment.

Thrown at the RPC boundary (worker → main thread) so the adapter layer
can catch it and the client factory can fall back to online-only mode.

## Extends

- `Exception`

## Constructors

### Constructor

> **new OpfsUnavailableException**(): `OpfsUnavailableException`

Defined in: packages/client/src/adapters/worker-core/probeOpfs.ts:21

#### Returns

`OpfsUnavailableException`

#### Overrides

`Exception.constructor`

## Properties

### \_details

> `protected` **\_details**: `unknown`

Defined in: node_modules/@meticoeus/ddd-es/dist/src/types.d.ts:14

#### Inherited from

`Exception._details`

---

### \_userMessage

> `protected` **\_userMessage**: `string` \| `undefined`

Defined in: node_modules/@meticoeus/ddd-es/dist/src/types.d.ts:13

#### Inherited from

`Exception._userMessage`

---

### code?

> `readonly` `optional` **code**: `number`

Defined in: node_modules/@meticoeus/ddd-es/dist/src/types.d.ts:12

#### Inherited from

`Exception.code`

---

### errorCode

> `readonly` **errorCode**: `"OPFS_UNAVAILABLE"` = `'OPFS_UNAVAILABLE'`

Defined in: packages/client/src/adapters/worker-core/probeOpfs.ts:19

---

### message

> `readonly` **message**: `string`

Defined in: node_modules/@meticoeus/ddd-es/dist/src/types.d.ts:11

#### Inherited from

`Exception.message`

---

### name

> `readonly` **name**: `string`

Defined in: node_modules/@meticoeus/ddd-es/dist/src/types.d.ts:10

#### Inherited from

`Exception.name`

## Accessors

### details

#### Get Signature

> **get** **details**(): `Details` \| `undefined`

Defined in: node_modules/@meticoeus/ddd-es/dist/src/types.d.ts:17

##### Returns

`Details` \| `undefined`

#### Inherited from

`Exception.details`

---

### userMessage

#### Get Signature

> **get** **userMessage**(): `string`

Defined in: node_modules/@meticoeus/ddd-es/dist/src/types.d.ts:16

##### Returns

`string`

#### Inherited from

`Exception.userMessage`

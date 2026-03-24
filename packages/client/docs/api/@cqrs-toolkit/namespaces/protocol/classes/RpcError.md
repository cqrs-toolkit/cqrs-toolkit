[**@cqrs-toolkit/client**](../../../../README.md)

---

[@cqrs-toolkit/client](../../../../globals.md) / [protocol](../README.md) / RpcError

# Class: RpcError

Error thrown when an RPC request to the worker fails.

Carries the optional `errorCode` from the worker-side error so the
adapter layer can reconstruct typed exceptions (e.g., OpfsUnavailableException).

## Extends

- `Error`

## Constructors

### Constructor

> **new RpcError**(`message`, `errorCode?`): `RpcError`

#### Parameters

##### message

`string`

##### errorCode?

`string`

#### Returns

`RpcError`

#### Overrides

`Error.constructor`

## Properties

### cause?

> `optional` **cause**: `unknown`

#### Inherited from

`Error.cause`

---

### errorCode

> `readonly` **errorCode**: `string` \| `undefined`

---

### message

> **message**: `string`

#### Inherited from

`Error.message`

---

### name

> **name**: `string`

#### Inherited from

`Error.name`

---

### stack?

> `optional` **stack**: `string`

#### Inherited from

`Error.stack`

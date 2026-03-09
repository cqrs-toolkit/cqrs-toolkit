[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / OpfsUnavailableException

# Class: OpfsUnavailableException

OPFS is not available in this worker environment.

Thrown at the RPC boundary (worker → main thread) so the adapter layer
can catch it and the client factory can fall back to online-only mode.

## Extends

- `Exception`

## Constructors

### Constructor

> **new OpfsUnavailableException**(): `OpfsUnavailableException`

#### Returns

`OpfsUnavailableException`

#### Overrides

`Exception.constructor`

## Properties

### \_details

> `protected` **\_details**: `unknown`

#### Inherited from

`Exception._details`

---

### \_userMessage

> `protected` **\_userMessage**: `string` \| `undefined`

#### Inherited from

`Exception._userMessage`

---

### code?

> `readonly` `optional` **code**: `number`

#### Inherited from

`Exception.code`

---

### errorCode

> `readonly` **errorCode**: `"OPFS_UNAVAILABLE"` = `'OPFS_UNAVAILABLE'`

---

### message

> `readonly` **message**: `string`

#### Inherited from

`Exception.message`

---

### name

> `readonly` **name**: `string`

#### Inherited from

`Exception.name`

## Accessors

### details

#### Get Signature

> **get** **details**(): `Details` \| `undefined`

##### Returns

`Details` \| `undefined`

#### Inherited from

`Exception.details`

---

### userMessage

#### Get Signature

> **get** **userMessage**(): `string`

##### Returns

`string`

#### Inherited from

`Exception.userMessage`

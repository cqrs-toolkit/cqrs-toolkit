[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandSendException

# Class: CommandSendException

Expected domain failure from command sending.
Returned via Result, never thrown.

## Extends

- `Exception`

## Constructors

### Constructor

> **new CommandSendException**(`message`, `errorCode`, `isRetryable`, `details?`): `CommandSendException`

#### Parameters

##### message

`string`

##### errorCode

`string`

##### isRetryable

`boolean`

##### details?

`unknown`

#### Returns

`CommandSendException`

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

> `readonly` **errorCode**: `string`

---

### isRetryable

> `readonly` **isRetryable**: `boolean`

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

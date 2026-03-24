[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandSendError

# Class: CommandSendError

Error thrown when command sending fails.

## Extends

- `Error`

## Constructors

### Constructor

> **new CommandSendError**(`message`, `code`, `isRetryable`, `details?`): `CommandSendError`

#### Parameters

##### message

`string`

##### code

`string`

##### isRetryable

`boolean`

##### details?

`unknown`

#### Returns

`CommandSendError`

#### Overrides

`Error.constructor`

## Properties

### cause?

> `optional` **cause**: `unknown`

#### Inherited from

`Error.cause`

---

### code

> `readonly` **code**: `string`

---

### details?

> `readonly` `optional` **details**: `unknown`

---

### isRetryable

> `readonly` **isRetryable**: `boolean`

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

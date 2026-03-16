[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [server](../README.md) / ForbiddenException

# Class: ForbiddenException

## Extends

- `Exception`

## Constructors

### Constructor

> **new ForbiddenException**(`message?`, `details?`): `ForbiddenException`

#### Parameters

##### message?

`string` = `'Forbidden'`

##### details?

`unknown`

#### Returns

`ForbiddenException`

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

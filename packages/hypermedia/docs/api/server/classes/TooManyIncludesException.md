[**@cqrs-toolkit/hypermedia**](../../README.md)

---

[@cqrs-toolkit/hypermedia](../../modules.md) / [server](../README.md) / TooManyIncludesException

# Class: TooManyIncludesException

## Extends

- [`BadRequestException`](BadRequestException.md)

## Constructors

### Constructor

> **new TooManyIncludesException**(`max`, `tokens`): `TooManyIncludesException`

#### Parameters

##### max

`number`

##### tokens

`string`[]

#### Returns

`TooManyIncludesException`

#### Overrides

[`BadRequestException`](BadRequestException.md).[`constructor`](BadRequestException.md#constructor)

## Properties

### \_details

> `protected` **\_details**: `unknown`

#### Inherited from

[`BadRequestException`](BadRequestException.md).[`_details`](BadRequestException.md#_details)

---

### \_userMessage

> `protected` **\_userMessage**: `string` \| `undefined`

#### Inherited from

[`BadRequestException`](BadRequestException.md).[`_userMessage`](BadRequestException.md#_usermessage)

---

### code?

> `readonly` `optional` **code**: `number`

#### Inherited from

[`BadRequestException`](BadRequestException.md).[`code`](BadRequestException.md#code)

---

### message

> `readonly` **message**: `string`

#### Inherited from

[`BadRequestException`](BadRequestException.md).[`message`](BadRequestException.md#message)

---

### name

> `readonly` **name**: `string`

#### Inherited from

[`BadRequestException`](BadRequestException.md).[`name`](BadRequestException.md#name)

## Accessors

### details

#### Get Signature

> **get** **details**(): `Details` \| `undefined`

##### Returns

`Details` \| `undefined`

#### Inherited from

[`BadRequestException`](BadRequestException.md).[`details`](BadRequestException.md#details)

---

### userMessage

#### Get Signature

> **get** **userMessage**(): `string`

##### Returns

`string`

#### Inherited from

[`BadRequestException`](BadRequestException.md).[`userMessage`](BadRequestException.md#usermessage)

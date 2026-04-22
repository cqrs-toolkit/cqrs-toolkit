[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / StreamIdParseException

# Class: StreamIdParseException

Type exports for the CQRS Client library.

## Extends

- `Exception`

## Constructors

### Constructor

> **new StreamIdParseException**(`streamId`): `StreamIdParseException`

#### Parameters

##### streamId

`string`

#### Returns

`StreamIdParseException`

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

[`OpfsUnavailableException`](OpfsUnavailableException.md).[`code`](OpfsUnavailableException.md#code)

---

### message

> `readonly` **message**: `string`

#### Inherited from

[`OpfsUnavailableException`](OpfsUnavailableException.md).[`message`](OpfsUnavailableException.md#message)

---

### name

> `readonly` **name**: `string`

#### Inherited from

[`OpfsUnavailableException`](OpfsUnavailableException.md).[`name`](OpfsUnavailableException.md#name)

---

### streamId

> `readonly` **streamId**: `string`

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

[`OpfsUnavailableException`](OpfsUnavailableException.md).[`userMessage`](OpfsUnavailableException.md#usermessage)

[**@cqrs-toolkit/schema**](../README.md)

---

[@cqrs-toolkit/schema](../README.md) / SchemaException

# Class: SchemaException

## Extends

- `ValidationException`\<[`FieldError`](../interfaces/FieldError.md)[]\>

## Constructors

### Constructor

> **new SchemaException**(`errors`): `SchemaException`

#### Parameters

##### errors

[`FieldError`](../interfaces/FieldError.md)[]

#### Returns

`SchemaException`

#### Overrides

`ValidationException<FieldError[]>.constructor`

## Properties

### \_details

> `protected` **\_details**: [`FieldError`](../interfaces/FieldError.md)[] \| `undefined`

#### Inherited from

`ValidationException._details`

---

### \_userMessage

> `protected` **\_userMessage**: `string` \| `undefined`

#### Inherited from

`ValidationException._userMessage`

---

### code?

> `readonly` `optional` **code**: `number`

#### Inherited from

`ValidationException.code`

---

### message

> `readonly` **message**: `string`

#### Inherited from

`ValidationException.message`

---

### name

> `readonly` **name**: `string`

#### Inherited from

`ValidationException.name`

## Accessors

### details

#### Get Signature

> **get** **details**(): `Details` \| `undefined`

##### Returns

`Details` \| `undefined`

#### Inherited from

`ValidationException.details`

---

### userMessage

#### Get Signature

> **get** **userMessage**(): `string`

##### Returns

`string`

#### Inherited from

`ValidationException.userMessage`

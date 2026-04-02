[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ValidationException

# Class: ValidationException

## Extends

- `Exception`\<[`ValidationError`](../interfaces/ValidationError.md)[]\>

## Constructors

### Constructor

> **new ValidationException**(`details`, `message?`): `ValidationException`

#### Parameters

##### details

[`ValidationError`](../interfaces/ValidationError.md)[]

##### message?

`string` = ``'Validation failed. See `details` for more information.'``

#### Returns

`ValidationException`

#### Overrides

`Exception<ValidationError[]>.constructor`

## Properties

### \_details

> `protected` **\_details**: [`ValidationError`](../interfaces/ValidationError.md)[] \| `undefined`

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

[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EnqueueAndWaitException

# Class: EnqueueAndWaitException

Exception for enqueueAndWait failures, carrying validation errors and their source.

## Extends

- `Exception`\<\{ `errors`: [`ValidationError`](../interfaces/ValidationError.md)[]; `source`: [`CommandErrorSource`](../type-aliases/CommandErrorSource.md); \}\>

## Constructors

### Constructor

> **new EnqueueAndWaitException**(`errors`, `source`): `EnqueueAndWaitException`

#### Parameters

##### errors

[`ValidationError`](../interfaces/ValidationError.md)[]

##### source

[`CommandErrorSource`](../type-aliases/CommandErrorSource.md)

#### Returns

`EnqueueAndWaitException`

#### Overrides

`Exception<{ errors: ValidationError[] source: CommandErrorSource }>.constructor`

## Properties

### \_details

> `protected` **\_details**: \{ `errors`: [`ValidationError`](../interfaces/ValidationError.md)[]; `source`: [`CommandErrorSource`](../type-aliases/CommandErrorSource.md); \} \| `undefined`

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

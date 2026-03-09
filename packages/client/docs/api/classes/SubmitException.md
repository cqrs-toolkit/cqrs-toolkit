[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SubmitException

# Class: SubmitException

Exception for submit failures.

`details.commandId` is set when the command IS in the queue despite the error
(server rejection, timeout). The consumer can use it to retry or track.

## Extends

- `Exception`\<\{ `commandId?`: `string`; `errors`: [`ValidationError`](../interfaces/ValidationError.md)[]; `source`: [`CommandErrorSource`](../type-aliases/CommandErrorSource.md); \}\>

## Constructors

### Constructor

> **new SubmitException**(`errors`, `source`, `commandId?`): `SubmitException`

#### Parameters

##### errors

[`ValidationError`](../interfaces/ValidationError.md)[]

##### source

[`CommandErrorSource`](../type-aliases/CommandErrorSource.md)

##### commandId?

`string`

#### Returns

`SubmitException`

#### Overrides

`Exception<{ errors: ValidationError[] source: CommandErrorSource commandId?: string }>.constructor`

## Properties

### \_details

> `protected` **\_details**: \{ `commandId?`: `string`; `errors`: [`ValidationError`](../interfaces/ValidationError.md)[]; `source`: [`CommandErrorSource`](../type-aliases/CommandErrorSource.md); \} \| `undefined`

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

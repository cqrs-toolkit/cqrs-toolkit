[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SubmitException

# Class: SubmitException

Defined in: [packages/client/src/types/commands.ts:312](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/commands.ts#L312)

Exception for submit failures.

`details.commandId` is set when the command IS in the queue despite the error
(server rejection, timeout). The consumer can use it to retry or track.

## Extends

- `Exception`\<\{ `commandId?`: `string`; `errors`: [`ValidationError`](../interfaces/ValidationError.md)[]; `source`: [`CommandErrorSource`](../type-aliases/CommandErrorSource.md); \}\>

## Constructors

### Constructor

> **new SubmitException**(`errors`, `source`, `commandId?`): `SubmitException`

Defined in: [packages/client/src/types/commands.ts:317](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/93be80a21907f07a104ca0e358c4b366dbf08b7d/packages/client/src/types/commands.ts#L317)

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

Defined in: node_modules/@meticoeus/ddd-es/dist/src/types.d.ts:14

#### Inherited from

`Exception._details`

---

### \_userMessage

> `protected` **\_userMessage**: `string` \| `undefined`

Defined in: node_modules/@meticoeus/ddd-es/dist/src/types.d.ts:13

#### Inherited from

`Exception._userMessage`

---

### code?

> `readonly` `optional` **code**: `number`

Defined in: node_modules/@meticoeus/ddd-es/dist/src/types.d.ts:12

#### Inherited from

`Exception.code`

---

### message

> `readonly` **message**: `string`

Defined in: node_modules/@meticoeus/ddd-es/dist/src/types.d.ts:11

#### Inherited from

`Exception.message`

---

### name

> `readonly` **name**: `string`

Defined in: node_modules/@meticoeus/ddd-es/dist/src/types.d.ts:10

#### Inherited from

`Exception.name`

## Accessors

### details

#### Get Signature

> **get** **details**(): `Details` \| `undefined`

Defined in: node_modules/@meticoeus/ddd-es/dist/src/types.d.ts:17

##### Returns

`Details` \| `undefined`

#### Inherited from

`Exception.details`

---

### userMessage

#### Get Signature

> **get** **userMessage**(): `string`

Defined in: node_modules/@meticoeus/ddd-es/dist/src/types.d.ts:16

##### Returns

`string`

#### Inherited from

`Exception.userMessage`

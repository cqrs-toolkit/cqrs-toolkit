[**@cqrs-toolkit/client**](../README.md)

***

[@cqrs-toolkit/client](../globals.md) / EnqueueAndWaitException

# Class: EnqueueAndWaitException

Defined in: packages/client/src/types/commands.ts:187

Exception for enqueueAndWait failures, carrying validation errors and their source.

## Extends

- `Exception`\<\{ `errors`: [`ValidationError`](../interfaces/ValidationError.md)[]; `source`: [`CommandErrorSource`](../type-aliases/CommandErrorSource.md); \}\>

## Constructors

### Constructor

> **new EnqueueAndWaitException**(`errors`, `source`): `EnqueueAndWaitException`

Defined in: packages/client/src/types/commands.ts:191

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

Defined in: node\_modules/@meticoeus/ddd-es/dist/src/types.d.ts:14

#### Inherited from

`Exception._details`

***

### \_userMessage

> `protected` **\_userMessage**: `string` \| `undefined`

Defined in: node\_modules/@meticoeus/ddd-es/dist/src/types.d.ts:13

#### Inherited from

`Exception._userMessage`

***

### code?

> `readonly` `optional` **code**: `number`

Defined in: node\_modules/@meticoeus/ddd-es/dist/src/types.d.ts:12

#### Inherited from

`Exception.code`

***

### message

> `readonly` **message**: `string`

Defined in: node\_modules/@meticoeus/ddd-es/dist/src/types.d.ts:11

#### Inherited from

`Exception.message`

***

### name

> `readonly` **name**: `string`

Defined in: node\_modules/@meticoeus/ddd-es/dist/src/types.d.ts:10

#### Inherited from

`Exception.name`

## Accessors

### details

#### Get Signature

> **get** **details**(): `Details` \| `undefined`

Defined in: node\_modules/@meticoeus/ddd-es/dist/src/types.d.ts:17

##### Returns

`Details` \| `undefined`

#### Inherited from

`Exception.details`

***

### userMessage

#### Get Signature

> **get** **userMessage**(): `string`

Defined in: node\_modules/@meticoeus/ddd-es/dist/src/types.d.ts:16

##### Returns

`string`

#### Inherited from

`Exception.userMessage`

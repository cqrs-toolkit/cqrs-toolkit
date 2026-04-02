[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandFailedException

# Class: CommandFailedException

A command failed during processing (server rejection, validation, or local error).

## Extends

- `Exception`\<[`CommandFailedDetails`](../interfaces/CommandFailedDetails.md)\>

## Constructors

### Constructor

> **new CommandFailedException**(`source`, `message`, `opts?`): `CommandFailedException`

#### Parameters

##### source

[`CommandErrorSource`](../type-aliases/CommandErrorSource.md)

##### message

`string`

##### opts?

`Omit`\<[`CommandFailedDetails`](../interfaces/CommandFailedDetails.md), `"source"`\>

#### Returns

`CommandFailedException`

#### Overrides

`Exception<CommandFailedDetails>.constructor`

## Properties

### \_details

> `protected` **\_details**: [`CommandFailedDetails`](../interfaces/CommandFailedDetails.md) \| `undefined`

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

### errorCode?

> `readonly` `optional` **errorCode**: `string`

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

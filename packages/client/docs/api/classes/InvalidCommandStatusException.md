[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / InvalidCommandStatusException

# Class: InvalidCommandStatusException

The command's current status does not allow the requested operation.

## Extends

- `Exception`\<\{ `status`: [`CommandStatus`](../type-aliases/CommandStatus.md); \}\>

## Constructors

### Constructor

> **new InvalidCommandStatusException**(`message`, `status`): `InvalidCommandStatusException`

#### Parameters

##### message

`string`

##### status

[`CommandStatus`](../type-aliases/CommandStatus.md)

#### Returns

`InvalidCommandStatusException`

#### Overrides

`Exception<{ status: CommandStatus }>.constructor`

## Properties

### \_details

> `protected` **\_details**: \{ `status`: [`CommandStatus`](../type-aliases/CommandStatus.md); \} \| `undefined`

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

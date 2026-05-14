[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ConflictException

# Class: ConflictException

The handler detected that the command cannot proceed cleanly against the
current state — either the user's edit conflicts with a server change, or
the user's intent is already satisfied, or a precondition has shifted.

Returned as the `'conflict'` variant of `DomainExecutionOutcome` (see
`types/domain.ts`). The library routes the carried `category` through the
same dispatch as server-derived failures.

## Extends

- `Exception`\<\{ `category`: [`FailureCategory`](../type-aliases/FailureCategory.md); `details?`: `unknown`; `errorCode?`: `string`; \}\>

## Constructors

### Constructor

> **new ConflictException**(`opts`): `ConflictException`

#### Parameters

##### opts

###### category

[`FailureCategory`](../type-aliases/FailureCategory.md)

###### details?

`unknown`

###### errorCode?

`string`

###### message

`string`

#### Returns

`ConflictException`

#### Overrides

`Exception<{ category: FailureCategory errorCode?: string details?: unknown }>.constructor`

## Properties

### \_details

> `protected` **\_details**: \{ `category`: [`FailureCategory`](../type-aliases/FailureCategory.md); `details?`: `unknown`; `errorCode?`: `string`; \} \| `undefined`

#### Inherited from

`Exception._details`

---

### \_userMessage

> `protected` **\_userMessage**: `string` \| `undefined`

#### Inherited from

`Exception._userMessage`

---

### category

> `readonly` **category**: [`FailureCategory`](../type-aliases/FailureCategory.md)

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

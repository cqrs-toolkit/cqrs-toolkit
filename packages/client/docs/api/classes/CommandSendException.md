[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / CommandSendException

# Class: CommandSendException

Expected domain failure from command sending.
Returned via Result, never thrown.

Carries the parsed [ServerErrorResponse](../interfaces/ServerErrorResponse.md) when the failure was a
server response (HTTP error status); absent for transport-level errors
where there is no response (network failure, fetch threw). The queue uses
`response` to drive its pluggable failure-mapping pipeline when present;
for transport errors it falls back to `isRetryable` (defaults to `false`).

The exception itself does **not** carry a `FailureCategory` — categorization
happens at the queue, where per-command and global `mapFailure` overrides
compose with the library's default mappers (see `0004 §4.8.3`). Consumers
reading the persisted `error?: IException` on a `CommandRecord` get a
`CommandFailedException` with `category` populated.

## Extends

- `Exception`\<\{ `details?`: `unknown`; `errorCode?`: `string`; `isRetryable`: `boolean`; `response?`: [`ServerErrorResponse`](../interfaces/ServerErrorResponse.md); \}\>

## Constructors

### Constructor

> **new CommandSendException**(`args`): `CommandSendException`

#### Parameters

##### args

###### details?

`unknown`

###### errorCode?

`string`

###### isRetryable?

`boolean`

Only consulted when `response` is undefined (transport-level errors). Defaults to false.

###### message

`string`

###### response?

[`ServerErrorResponse`](../interfaces/ServerErrorResponse.md)

#### Returns

`CommandSendException`

#### Overrides

`Exception<{ errorCode?: string isRetryable: boolean response?: ServerErrorResponse details?: unknown }>.constructor`

## Properties

### \_details

> `protected` **\_details**: \{ `details?`: `unknown`; `errorCode?`: `string`; `isRetryable`: `boolean`; `response?`: [`ServerErrorResponse`](../interfaces/ServerErrorResponse.md); \} \| `undefined`

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

### isRetryable

> `readonly` **isRetryable**: `boolean`

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

### response?

> `readonly` `optional` **response**: [`ServerErrorResponse`](../interfaces/ServerErrorResponse.md)

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

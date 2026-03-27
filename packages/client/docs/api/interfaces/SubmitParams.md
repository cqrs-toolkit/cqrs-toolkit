[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SubmitParams

# Interface: SubmitParams\<TLink, TCommand\>

Parameters for [CqrsClient.submit](../classes/CqrsClient.md#submit).

## Extends

- [`SubmitOptions`](SubmitOptions.md)\<`TLink`\>

## Type Parameters

### TLink

`TLink` _extends_ `Link`

### TCommand

`TCommand` _extends_ [`EnqueueCommand`](EnqueueCommand.md) = [`EnqueueCommand`](EnqueueCommand.md)

## Properties

### cacheKey

> **cacheKey**: [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

Cache key identity — associates anticipated events and response events with the correct data scope.

#### Inherited from

[`SubmitOptions`](SubmitOptions.md).[`cacheKey`](SubmitOptions.md#cachekey)

---

### command

> **command**: `TCommand`

Command to submit

---

### commandId?

> `optional` **commandId**: `string`

Custom command ID (defaults to generated UUID)

#### Inherited from

[`SubmitOptions`](SubmitOptions.md).[`commandId`](SubmitOptions.md#commandid)

---

### skipValidation?

> `optional` **skipValidation**: `boolean`

Skip local domain validation

#### Inherited from

[`SubmitOptions`](SubmitOptions.md).[`skipValidation`](SubmitOptions.md#skipvalidation)

---

### timeout?

> `optional` **timeout**: `number`

Timeout in milliseconds (default: 30000)

#### Inherited from

[`SubmitOptions`](SubmitOptions.md).[`timeout`](SubmitOptions.md#timeout)

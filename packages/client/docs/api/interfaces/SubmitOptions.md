[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / SubmitOptions

# Interface: SubmitOptions\<TLink\>

Options for the network-aware submit operation.

## Extends

- [`EnqueueOptions`](EnqueueOptions.md)\<`TLink`\>.[`WaitOptions`](WaitOptions.md)

## Extended by

- [`SubmitParams`](SubmitParams.md)

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Properties

### cacheKey

> **cacheKey**: [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

Cache key identity — associates anticipated events and response events with the correct data scope.

#### Inherited from

[`EnqueueOptions`](EnqueueOptions.md).[`cacheKey`](EnqueueOptions.md#cachekey)

---

### commandId?

> `optional` **commandId**: `string`

Custom command ID (defaults to generated UUID)

#### Inherited from

[`EnqueueOptions`](EnqueueOptions.md).[`commandId`](EnqueueOptions.md#commandid)

---

### modelState?

> `optional` **modelState**: `unknown`

Read-model snapshot at submission time, passed to the domain executor as
the handler's initial state. State-dependent anticipated event handlers
use this so the optimistic event reflects what the user saw when they
submitted.

#### Inherited from

[`EnqueueOptions`](EnqueueOptions.md).[`modelState`](EnqueueOptions.md#modelstate)

---

### skipValidation?

> `optional` **skipValidation**: `boolean`

Skip local domain validation

#### Inherited from

[`EnqueueOptions`](EnqueueOptions.md).[`skipValidation`](EnqueueOptions.md#skipvalidation)

---

### timeout?

> `optional` **timeout**: `number`

Timeout in milliseconds (default: 30000)

#### Inherited from

[`WaitOptions`](WaitOptions.md).[`timeout`](WaitOptions.md#timeout)

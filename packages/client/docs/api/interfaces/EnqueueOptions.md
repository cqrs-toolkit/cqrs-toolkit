[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EnqueueOptions

# Interface: EnqueueOptions\<TLink\>

Options for enqueue operation.

## Extended by

- [`EnqueueAndWaitOptions`](EnqueueAndWaitOptions.md)
- [`SubmitOptions`](SubmitOptions.md)

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Properties

### cacheKey

> **cacheKey**: [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

Cache key identity — associates anticipated events and response events with the correct data scope.

---

### commandId?

> `optional` **commandId**: `string`

Custom command ID (defaults to generated UUID)

---

### modelState?

> `optional` **modelState**: `unknown`

Read-model snapshot at submission time, passed to the domain executor as
the handler's initial state. State-dependent anticipated event handlers
use this so the optimistic event reflects what the user saw when they
submitted.

---

### skipValidation?

> `optional` **skipValidation**: `boolean`

Skip local domain validation

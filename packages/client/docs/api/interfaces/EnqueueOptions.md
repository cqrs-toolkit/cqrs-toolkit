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

### skipValidation?

> `optional` **skipValidation**: `boolean`

Skip local domain validation

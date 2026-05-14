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

Read-model snapshot the user was operating against at submission time.
Persisted durably on the command record and surfaced as the `initial`
half of [HandlerState](../type-aliases/HandlerState.md) to validate / validateAsync / handler. On
reconciliation re-runs the queue computes a post-server-event `updated`
companion so a state-dependent handler can decide whether the user's
edit is still valid. Pass it whenever the command is being submitted
against an existing entity; omit when there is no relevant prior state
(e.g. a create against an unseeded collection).

---

### skipValidation?

> `optional` **skipValidation**: `boolean`

Skip local domain validation

[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / EnqueueAndWaitOptions

# Interface: EnqueueAndWaitOptions\<TLink\>

Options for enqueueAndWait operation.

## Extends

- [`EnqueueOptions`](EnqueueOptions.md)\<`TLink`\>.[`WaitOptions`](WaitOptions.md)

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

Read-model snapshot the user was operating against at submission time.
Persisted durably on the command record and surfaced as the `initial`
half of [HandlerState](../type-aliases/HandlerState.md) to validate / validateAsync / handler. On
reconciliation re-runs the queue computes a post-server-event `updated`
companion so a state-dependent handler can decide whether the user's
edit is still valid. Pass it whenever the command is being submitted
against an existing entity; omit when there is no relevant prior state
(e.g. a create against an unseeded collection).

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

---

### waitFor?

> `optional` **waitFor**: `"succeeded"` \| `"applied"`

Terminal state to wait for. Default `'applied'` — the sync pipeline has
reflected the command's response events in the read model. Override with
`'succeeded'` to resolve earlier at server acknowledgement, before the
read-model drain completes.

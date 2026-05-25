[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ViewLocalApi

# Interface: ViewLocalApi

Tight subset of the in-memory storage surface exposed to a view's `memory`
closure. Intentionally minimal — one method.

Consumers build whatever indexes they need from the iterator (typically a
`Map` from FK to record). The library does not pre-bucket data by FK, does
not parse / hydrate / re-shape — the closure has full control.

`hasLocalChanges` is included per row so the consumer can roll the flag up
into the public result if needed. Ignore when irrelevant.

## Methods

### iterate()

> **iterate**\<`T`\>(`collection`): `Iterable`\<\{ `data`: `T`; `hasLocalChanges`: `boolean`; `id`: `string`; \}\>

#### Type Parameters

##### T

`T`

#### Parameters

##### collection

`string`

#### Returns

`Iterable`\<\{ `data`: `T`; `hasLocalChanges`: `boolean`; `id`: `string`; \}\>

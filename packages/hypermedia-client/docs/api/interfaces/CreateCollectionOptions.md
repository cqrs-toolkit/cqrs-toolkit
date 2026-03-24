[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../README.md) / CreateCollectionOptions

# Interface: CreateCollectionOptions

Options for creating a collection from a representation.

## Properties

### aggregateId()?

> `optional` **aggregateId**: (`streamId`) => `string`

Extract aggregate ID from streamId for item event URL expansion.
Default: splits on first '-' (convention: 'Todo-{uuid}' → '{uuid}')

#### Parameters

##### streamId

`string`

#### Returns

`string`

---

### getTopics()

> **getTopics**: () => `string`[]

App-specific: WS topic patterns to subscribe to

#### Returns

`string`[]

---

### matchesStream()

> **matchesStream**: (`streamId`) => `boolean`

App-specific: test whether a streamId belongs to this collection

#### Parameters

##### streamId

`string`

#### Returns

`boolean`

---

### name

> **name**: `string`

Collection name (e.g. 'todos')

---

### representation

> **representation**: [`RepresentationSurfaces`](RepresentationSurfaces.md)

Representation surface data from generated representations.ts

[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / LibraryEventPayloads

# Interface: LibraryEventPayloads

Library event payload types.

## Properties

### cache:evicted

> **cache:evicted**: `object`

#### cacheKey

> **cacheKey**: `string`

#### reason

> **reason**: `"explicit"` \| `"lru"` \| `"expired"` \| `"session-change"`

---

### cache:key-acquired

> **cache:key-acquired**: `object`

#### cacheKey

> **cacheKey**: `string`

#### collection

> **collection**: `string`

#### evictionPolicy

> **evictionPolicy**: `string`

#### params?

> `optional` **params**: `Record`\<`string`, `unknown`\>

---

### cache:session-reset

> **cache:session-reset**: `object`

#### newUserId

> **newUserId**: `string`

#### previousUserId

> **previousUserId**: `string`

---

### cache:too-many-windows

> **cache:too-many-windows**: `object`

#### maxWindows

> **maxWindows**: `number`

#### windowId

> **windowId**: `string`

---

### command:completed

> **command:completed**: `object`

#### commandId

> **commandId**: `string`

#### type

> **type**: `string`

---

### command:enqueued

> **command:enqueued**: `object`

#### commandId

> **commandId**: `string`

#### type

> **type**: `string`

---

### command:failed

> **command:failed**: `object`

#### commandId

> **commandId**: `string`

#### error

> **error**: `string`

#### type

> **type**: `string`

---

### command:response

> **command:response**: `object`

#### commandId

> **commandId**: `string`

#### correlationId

> **correlationId**: `string`

#### response

> **response**: `unknown`

---

### command:sent

> **command:sent**: `object`

#### commandId

> **commandId**: `string`

#### correlationId

> **correlationId**: `string`

#### payload

> **payload**: `unknown`

#### service

> **service**: `string`

#### type

> **type**: `string`

---

### command:status-changed

> **command:status-changed**: `object`

#### commandId

> **commandId**: `string`

#### previousStatus

> **previousStatus**: `string`

#### status

> **status**: `string`

---

### connectivity:changed

> **connectivity:changed**: `object`

#### online

> **online**: `boolean`

---

### error:network

> **error:network**: `object`

#### code?

> `optional` **code**: `string`

#### message

> **message**: `string`

---

### error:storage

> **error:storage**: `object`

#### code?

> `optional` **code**: `string`

#### message

> **message**: `string`

---

### readmodel:updated

> **readmodel:updated**: `object`

#### collection

> **collection**: `string`

#### ids

> **ids**: `string`[]

---

### session:changed

> **session:changed**: `object`

#### isNew

> **isNew**: `boolean`

#### userId

> **userId**: `string`

---

### session:destroyed

> **session:destroyed**: `object`

#### reason

> **reason**: `"user-changed"` \| `"explicit"` \| `"storage-error"`

---

### sync:completed

> **sync:completed**: `object`

#### collection

> **collection**: `string`

#### eventCount

> **eventCount**: `number`

---

### sync:failed

> **sync:failed**: `object`

#### collection

> **collection**: `string`

#### error

> **error**: `string`

---

### sync:gap-detected

> **sync:gap-detected**: `object`

#### expected

> **expected**: `bigint`

#### received

> **received**: `bigint`

#### streamId

> **streamId**: `string`

---

### sync:gap-repair-completed

> **sync:gap-repair-completed**: `object`

#### eventCount

> **eventCount**: `number`

#### streamId

> **streamId**: `string`

---

### sync:gap-repair-started

> **sync:gap-repair-started**: `object`

#### fromRevision

> **fromRevision**: `bigint`

#### streamId

> **streamId**: `string`

---

### sync:refetch-executed

> **sync:refetch-executed**: `object`

#### collection

> **collection**: `string`

#### recordCount

> **recordCount**: `number`

---

### sync:refetch-scheduled

> **sync:refetch-scheduled**: `object`

#### collection

> **collection**: `string`

#### debounceMs

> **debounceMs**: `number`

---

### sync:seed-completed

> **sync:seed-completed**: `object`

#### cacheKey

> **cacheKey**: `string`

#### collection

> **collection**: `string`

#### recordCount

> **recordCount**: `number`

---

### sync:started

> **sync:started**: `object`

#### collection

> **collection**: `string`

---

### sync:ws-event-processed

> **sync:ws-event-processed**: `object`

#### event

> **event**: [`IPersistedEvent`](../type-aliases/IPersistedEvent.md)

#### invalidated

> **invalidated**: `boolean`

#### updatedIds

> **updatedIds**: `string`[]

---

### sync:ws-event-received

> **sync:ws-event-received**: `object`

#### event

> **event**: [`IPersistedEvent`](../type-aliases/IPersistedEvent.md)

---

### ws:connected

> **ws:connected**: `object`

---

### ws:connecting

> **ws:connecting**: `object`

---

### ws:disconnected

> **ws:disconnected**: `object`

#### topics

> **topics**: readonly `string`[]

---

### ws:subscribed

> **ws:subscribed**: `object`

#### topics

> **topics**: readonly `string`[]

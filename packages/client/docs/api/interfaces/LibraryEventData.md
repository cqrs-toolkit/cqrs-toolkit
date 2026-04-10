[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / LibraryEventData

# Interface: LibraryEventData\<TLink\>

Library event data types.

## Type Parameters

### TLink

`TLink` _extends_ `Link`

## Properties

### cache:evicted

> **cache:evicted**: `object`

#### cacheKey

> **cacheKey**: [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

#### reason

> **reason**: `"explicit"` \| `"lru"` \| `"expired"` \| `"session-change"`

---

### cache:frozen-changed

> **cache:frozen-changed**: `object`

#### cacheKey

> **cacheKey**: [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

#### frozen

> **frozen**: `boolean`

#### frozenAt

> **frozenAt**: `number` \| `null`

---

### cache:key-accessed

> **cache:key-accessed**: `object`

#### cacheKey

> **cacheKey**: [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

---

### cache:key-added

> **cache:key-added**: `object`

#### cacheKey

> **cacheKey**: [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

#### evictionPolicy

> **evictionPolicy**: `"persistent"` \| `"ephemeral"`

---

### cache:key-reconciled

> **cache:key-reconciled**: `object`

#### cacheKey

> **cacheKey**: [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

#### clientId

> **clientId**: `string`

#### commandId

> **commandId**: `string`

#### previousIdentity

> **previousIdentity**: [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

#### serverId

> **serverId**: `string`

---

### cache:quota-critical

> **cache:quota-critical**: `object`

#### totalBytes

> **totalBytes**: `number`

#### usedBytes

> **usedBytes**: `number`

---

### cache:quota-low

> **cache:quota-low**: `object`

#### totalBytes

> **totalBytes**: `number`

#### usedBytes

> **usedBytes**: `number`

---

### cache:seed-settled

> **cache:seed-settled**: `object`

#### cacheKey

> **cacheKey**: [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

#### collections

> **collections**: `object`[]

#### status

> **status**: `"succeeded"` \| `"failed"`

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

#### cacheKey

> **cacheKey**: [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

#### commandId

> **commandId**: `string`

#### type

> **type**: `string`

---

### command:enqueued

> **command:enqueued**: `object`

#### cacheKey

> **cacheKey**: [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

#### commandId

> **commandId**: `string`

#### type

> **type**: `string`

---

### command:failed

> **command:failed**: `object`

#### cacheKey

> **cacheKey**: [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

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

#### data

> **data**: `unknown`

#### service

> **service**: `string`

#### type

> **type**: `string`

---

### command:status-changed

> **command:status-changed**: `object`

#### cacheKey

> **cacheKey**: [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

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

> **cacheKey**: [`CacheKeyIdentity`](../type-aliases/CacheKeyIdentity.md)\<`TLink`\>

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

### writequeue:op-completed

> **writequeue:op-completed**: `object`

#### durationMs

> **durationMs**: `number`

#### opId

> **opId**: `string`

#### opType

> **opType**: `string`

---

### writequeue:op-discarded

> **writequeue:op-discarded**: `object`

#### opId

> **opId**: `string`

#### opType

> **opType**: `string`

#### reason

> **reason**: `string`

---

### writequeue:op-enqueued

> **writequeue:op-enqueued**: `object`

#### op

> **op**: `unknown`

#### opId

> **opId**: `string`

#### opType

> **opType**: `string`

#### priority

> **priority**: `number`

---

### writequeue:op-error

> **writequeue:op-error**: `object`

#### error

> **error**: `string`

#### opId

> **opId**: `string`

#### opType

> **opType**: `string`

---

### writequeue:op-started

> **writequeue:op-started**: `object`

#### opId

> **opId**: `string`

#### opType

> **opType**: `string`

---

### writequeue:reset-completed

> **writequeue:reset-completed**: `object`

#### reason

> **reason**: `string`

---

### writequeue:reset-started

> **writequeue:reset-started**: `object`

#### reason

> **reason**: `string`

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

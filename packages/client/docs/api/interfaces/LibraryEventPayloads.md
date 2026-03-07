[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / LibraryEventPayloads

# Interface: LibraryEventPayloads

Defined in: [packages/client/src/types/events.ts:76](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L76)

Library event payload types.

## Properties

### cache:evicted

> **cache:evicted**: `object`

Defined in: [packages/client/src/types/events.ts:83](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L83)

#### cacheKey

> **cacheKey**: `string`

#### reason

> **reason**: `"explicit"` \| `"lru"` \| `"expired"` \| `"session-change"`

---

### cache:key-acquired

> **cache:key-acquired**: `object`

Defined in: [packages/client/src/types/events.ts:103](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L103)

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

Defined in: [packages/client/src/types/events.ts:85](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L85)

#### newUserId

> **newUserId**: `string`

#### previousUserId

> **previousUserId**: `string`

---

### cache:too-many-windows

> **cache:too-many-windows**: `object`

Defined in: [packages/client/src/types/events.ts:84](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L84)

#### maxWindows

> **maxWindows**: `number`

#### windowId

> **windowId**: `string`

---

### command:completed

> **command:completed**: `object`

Defined in: [packages/client/src/types/events.ts:89](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L89)

#### commandId

> **commandId**: `string`

#### type

> **type**: `string`

---

### command:enqueued

> **command:enqueued**: `object`

Defined in: [packages/client/src/types/events.ts:87](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L87)

#### commandId

> **commandId**: `string`

#### type

> **type**: `string`

---

### command:failed

> **command:failed**: `object`

Defined in: [packages/client/src/types/events.ts:90](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L90)

#### commandId

> **commandId**: `string`

#### error

> **error**: `string`

#### type

> **type**: `string`

---

### command:response

> **command:response**: `object`

Defined in: [packages/client/src/types/events.ts:118](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L118)

#### commandId

> **commandId**: `string`

#### correlationId

> **correlationId**: `string`

#### response

> **response**: `unknown`

---

### command:sent

> **command:sent**: `object`

Defined in: [packages/client/src/types/events.ts:111](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L111)

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

Defined in: [packages/client/src/types/events.ts:88](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L88)

#### commandId

> **commandId**: `string`

#### previousStatus

> **previousStatus**: `string`

#### status

> **status**: `string`

---

### connectivity:changed

> **connectivity:changed**: `object`

Defined in: [packages/client/src/types/events.ts:79](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L79)

#### online

> **online**: `boolean`

---

### error:network

> **error:network**: `object`

Defined in: [packages/client/src/types/events.ts:93](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L93)

#### code?

> `optional` **code**: `string`

#### message

> **message**: `string`

---

### error:storage

> **error:storage**: `object`

Defined in: [packages/client/src/types/events.ts:92](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L92)

#### code?

> `optional` **code**: `string`

#### message

> **message**: `string`

---

### readmodel:updated

> **readmodel:updated**: `object`

Defined in: [packages/client/src/types/events.ts:91](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L91)

#### collection

> **collection**: `string`

#### ids

> **ids**: `string`[]

---

### session:changed

> **session:changed**: `object`

Defined in: [packages/client/src/types/events.ts:77](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L77)

#### isNew

> **isNew**: `boolean`

#### userId

> **userId**: `string`

---

### session:destroyed

> **session:destroyed**: `object`

Defined in: [packages/client/src/types/events.ts:78](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L78)

#### reason

> **reason**: `"user-changed"` \| `"explicit"` \| `"storage-error"`

---

### sync:completed

> **sync:completed**: `object`

Defined in: [packages/client/src/types/events.ts:81](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L81)

#### collection

> **collection**: `string`

#### eventCount

> **eventCount**: `number`

---

### sync:failed

> **sync:failed**: `object`

Defined in: [packages/client/src/types/events.ts:82](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L82)

#### collection

> **collection**: `string`

#### error

> **error**: `string`

---

### sync:gap-detected

> **sync:gap-detected**: `object`

Defined in: [packages/client/src/types/events.ts:100](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L100)

#### expected

> **expected**: `bigint`

#### received

> **received**: `bigint`

#### streamId

> **streamId**: `string`

---

### sync:gap-repair-completed

> **sync:gap-repair-completed**: `object`

Defined in: [packages/client/src/types/events.ts:102](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L102)

#### eventCount

> **eventCount**: `number`

#### streamId

> **streamId**: `string`

---

### sync:gap-repair-started

> **sync:gap-repair-started**: `object`

Defined in: [packages/client/src/types/events.ts:101](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L101)

#### fromRevision

> **fromRevision**: `bigint`

#### streamId

> **streamId**: `string`

---

### sync:refetch-executed

> **sync:refetch-executed**: `object`

Defined in: [packages/client/src/types/events.ts:110](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L110)

#### collection

> **collection**: `string`

#### recordCount

> **recordCount**: `number`

---

### sync:refetch-scheduled

> **sync:refetch-scheduled**: `object`

Defined in: [packages/client/src/types/events.ts:109](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L109)

#### collection

> **collection**: `string`

#### debounceMs

> **debounceMs**: `number`

---

### sync:seed-completed

> **sync:seed-completed**: `object`

Defined in: [packages/client/src/types/events.ts:86](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L86)

#### cacheKey

> **cacheKey**: `string`

#### collection

> **collection**: `string`

#### recordCount

> **recordCount**: `number`

---

### sync:started

> **sync:started**: `object`

Defined in: [packages/client/src/types/events.ts:80](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L80)

#### collection

> **collection**: `string`

---

### sync:ws-event-processed

> **sync:ws-event-processed**: `object`

Defined in: [packages/client/src/types/events.ts:99](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L99)

#### event

> **event**: [`IPersistedEvent`](../type-aliases/IPersistedEvent.md)

#### invalidated

> **invalidated**: `boolean`

#### updatedIds

> **updatedIds**: `string`[]

---

### sync:ws-event-received

> **sync:ws-event-received**: `object`

Defined in: [packages/client/src/types/events.ts:98](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L98)

#### event

> **event**: [`IPersistedEvent`](../type-aliases/IPersistedEvent.md)

---

### ws:connected

> **ws:connected**: `object`

Defined in: [packages/client/src/types/events.ts:95](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L95)

---

### ws:connecting

> **ws:connecting**: `object`

Defined in: [packages/client/src/types/events.ts:94](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L94)

---

### ws:disconnected

> **ws:disconnected**: `object`

Defined in: [packages/client/src/types/events.ts:97](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L97)

#### topics

> **topics**: readonly `string`[]

---

### ws:subscribed

> **ws:subscribed**: `object`

Defined in: [packages/client/src/types/events.ts:96](https://github.com/Swifttt-Dev/cqrs-toolkit/blob/master/packages/client/src/types/events.ts#L96)

#### topics

> **topics**: readonly `string`[]

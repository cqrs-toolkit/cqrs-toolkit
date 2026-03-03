[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../README.md) / LibraryEventPayloads

# Interface: LibraryEventPayloads

Defined in: packages/client/src/types/events.ts:104

Library event payload types.

## Properties

### cache:evicted

> **cache:evicted**: `object`

Defined in: packages/client/src/types/events.ts:111

#### cacheKey

> **cacheKey**: `string`

#### reason

> **reason**: `"explicit"` \| `"lru"` \| `"session-change"`

---

### command:completed

> **command:completed**: `object`

Defined in: packages/client/src/types/events.ts:114

#### commandId

> **commandId**: `string`

#### type

> **type**: `string`

---

### command:enqueued

> **command:enqueued**: `object`

Defined in: packages/client/src/types/events.ts:112

#### commandId

> **commandId**: `string`

#### type

> **type**: `string`

---

### command:failed

> **command:failed**: `object`

Defined in: packages/client/src/types/events.ts:115

#### commandId

> **commandId**: `string`

#### error

> **error**: `string`

#### type

> **type**: `string`

---

### command:status-changed

> **command:status-changed**: `object`

Defined in: packages/client/src/types/events.ts:113

#### commandId

> **commandId**: `string`

#### previousStatus

> **previousStatus**: `string`

#### status

> **status**: `string`

---

### connectivity:changed

> **connectivity:changed**: `object`

Defined in: packages/client/src/types/events.ts:107

#### online

> **online**: `boolean`

---

### error:network

> **error:network**: `object`

Defined in: packages/client/src/types/events.ts:118

#### code?

> `optional` **code**: `string`

#### message

> **message**: `string`

---

### error:storage

> **error:storage**: `object`

Defined in: packages/client/src/types/events.ts:117

#### code?

> `optional` **code**: `string`

#### message

> **message**: `string`

---

### readmodel:updated

> **readmodel:updated**: `object`

Defined in: packages/client/src/types/events.ts:116

#### collection

> **collection**: `string`

#### ids

> **ids**: `string`[]

---

### session:changed

> **session:changed**: `object`

Defined in: packages/client/src/types/events.ts:105

#### isNew

> **isNew**: `boolean`

#### userId

> **userId**: `string`

---

### session:destroyed

> **session:destroyed**: `object`

Defined in: packages/client/src/types/events.ts:106

#### reason

> **reason**: `"user-changed"` \| `"explicit"` \| `"storage-error"`

---

### sync:completed

> **sync:completed**: `object`

Defined in: packages/client/src/types/events.ts:109

#### collection

> **collection**: `string`

#### eventCount

> **eventCount**: `number`

---

### sync:failed

> **sync:failed**: `object`

Defined in: packages/client/src/types/events.ts:110

#### collection

> **collection**: `string`

#### error

> **error**: `string`

---

### sync:started

> **sync:started**: `object`

Defined in: packages/client/src/types/events.ts:108

#### collection

> **collection**: `string`

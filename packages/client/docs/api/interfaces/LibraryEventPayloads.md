[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / LibraryEventPayloads

# Interface: LibraryEventPayloads

Defined in: packages/client/src/types/events.ts:62

Library event payload types.

## Properties

### cache:evicted

> **cache:evicted**: `object`

Defined in: packages/client/src/types/events.ts:69

#### cacheKey

> **cacheKey**: `string`

#### reason

> **reason**: `"explicit"` \| `"lru"` \| `"expired"` \| `"session-change"`

---

### cache:session-reset

> **cache:session-reset**: `object`

Defined in: packages/client/src/types/events.ts:71

#### newUserId

> **newUserId**: `string`

#### previousUserId

> **previousUserId**: `string`

---

### cache:too-many-windows

> **cache:too-many-windows**: `object`

Defined in: packages/client/src/types/events.ts:70

#### maxWindows

> **maxWindows**: `number`

#### windowId

> **windowId**: `string`

---

### command:completed

> **command:completed**: `object`

Defined in: packages/client/src/types/events.ts:75

#### commandId

> **commandId**: `string`

#### type

> **type**: `string`

---

### command:enqueued

> **command:enqueued**: `object`

Defined in: packages/client/src/types/events.ts:73

#### commandId

> **commandId**: `string`

#### type

> **type**: `string`

---

### command:failed

> **command:failed**: `object`

Defined in: packages/client/src/types/events.ts:76

#### commandId

> **commandId**: `string`

#### error

> **error**: `string`

#### type

> **type**: `string`

---

### command:status-changed

> **command:status-changed**: `object`

Defined in: packages/client/src/types/events.ts:74

#### commandId

> **commandId**: `string`

#### previousStatus

> **previousStatus**: `string`

#### status

> **status**: `string`

---

### connectivity:changed

> **connectivity:changed**: `object`

Defined in: packages/client/src/types/events.ts:65

#### online

> **online**: `boolean`

---

### error:network

> **error:network**: `object`

Defined in: packages/client/src/types/events.ts:79

#### code?

> `optional` **code**: `string`

#### message

> **message**: `string`

---

### error:storage

> **error:storage**: `object`

Defined in: packages/client/src/types/events.ts:78

#### code?

> `optional` **code**: `string`

#### message

> **message**: `string`

---

### readmodel:updated

> **readmodel:updated**: `object`

Defined in: packages/client/src/types/events.ts:77

#### collection

> **collection**: `string`

#### ids

> **ids**: `string`[]

---

### session:changed

> **session:changed**: `object`

Defined in: packages/client/src/types/events.ts:63

#### isNew

> **isNew**: `boolean`

#### userId

> **userId**: `string`

---

### session:destroyed

> **session:destroyed**: `object`

Defined in: packages/client/src/types/events.ts:64

#### reason

> **reason**: `"user-changed"` \| `"explicit"` \| `"storage-error"`

---

### sync:completed

> **sync:completed**: `object`

Defined in: packages/client/src/types/events.ts:67

#### collection

> **collection**: `string`

#### eventCount

> **eventCount**: `number`

---

### sync:failed

> **sync:failed**: `object`

Defined in: packages/client/src/types/events.ts:68

#### collection

> **collection**: `string`

#### error

> **error**: `string`

---

### sync:seed-completed

> **sync:seed-completed**: `object`

Defined in: packages/client/src/types/events.ts:72

#### cacheKey

> **cacheKey**: `string`

#### collection

> **collection**: `string`

#### recordCount

> **recordCount**: `number`

---

### sync:started

> **sync:started**: `object`

Defined in: packages/client/src/types/events.ts:66

#### collection

> **collection**: `string`

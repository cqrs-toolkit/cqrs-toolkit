[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / LibraryEventPayloads

# Interface: LibraryEventPayloads

Defined in: packages/client/src/types/events.ts:66

Library event payload types.

## Properties

### cache:evicted

> **cache:evicted**: `object`

Defined in: packages/client/src/types/events.ts:73

#### cacheKey

> **cacheKey**: `string`

#### reason

> **reason**: `"explicit"` \| `"lru"` \| `"expired"` \| `"session-change"`

---

### cache:session-reset

> **cache:session-reset**: `object`

Defined in: packages/client/src/types/events.ts:75

#### newUserId

> **newUserId**: `string`

#### previousUserId

> **previousUserId**: `string`

---

### cache:too-many-windows

> **cache:too-many-windows**: `object`

Defined in: packages/client/src/types/events.ts:74

#### maxWindows

> **maxWindows**: `number`

#### windowId

> **windowId**: `string`

---

### command:completed

> **command:completed**: `object`

Defined in: packages/client/src/types/events.ts:79

#### commandId

> **commandId**: `string`

#### type

> **type**: `string`

---

### command:enqueued

> **command:enqueued**: `object`

Defined in: packages/client/src/types/events.ts:77

#### commandId

> **commandId**: `string`

#### type

> **type**: `string`

---

### command:failed

> **command:failed**: `object`

Defined in: packages/client/src/types/events.ts:80

#### commandId

> **commandId**: `string`

#### error

> **error**: `string`

#### type

> **type**: `string`

---

### command:status-changed

> **command:status-changed**: `object`

Defined in: packages/client/src/types/events.ts:78

#### commandId

> **commandId**: `string`

#### previousStatus

> **previousStatus**: `string`

#### status

> **status**: `string`

---

### connectivity:changed

> **connectivity:changed**: `object`

Defined in: packages/client/src/types/events.ts:69

#### online

> **online**: `boolean`

---

### error:network

> **error:network**: `object`

Defined in: packages/client/src/types/events.ts:83

#### code?

> `optional` **code**: `string`

#### message

> **message**: `string`

---

### error:storage

> **error:storage**: `object`

Defined in: packages/client/src/types/events.ts:82

#### code?

> `optional` **code**: `string`

#### message

> **message**: `string`

---

### readmodel:updated

> **readmodel:updated**: `object`

Defined in: packages/client/src/types/events.ts:81

#### collection

> **collection**: `string`

#### ids

> **ids**: `string`[]

---

### session:changed

> **session:changed**: `object`

Defined in: packages/client/src/types/events.ts:67

#### isNew

> **isNew**: `boolean`

#### userId

> **userId**: `string`

---

### session:destroyed

> **session:destroyed**: `object`

Defined in: packages/client/src/types/events.ts:68

#### reason

> **reason**: `"user-changed"` \| `"explicit"` \| `"storage-error"`

---

### sync:completed

> **sync:completed**: `object`

Defined in: packages/client/src/types/events.ts:71

#### collection

> **collection**: `string`

#### eventCount

> **eventCount**: `number`

---

### sync:failed

> **sync:failed**: `object`

Defined in: packages/client/src/types/events.ts:72

#### collection

> **collection**: `string`

#### error

> **error**: `string`

---

### sync:seed-completed

> **sync:seed-completed**: `object`

Defined in: packages/client/src/types/events.ts:76

#### cacheKey

> **cacheKey**: `string`

#### collection

> **collection**: `string`

#### recordCount

> **recordCount**: `number`

---

### sync:started

> **sync:started**: `object`

Defined in: packages/client/src/types/events.ts:70

#### collection

> **collection**: `string`

---

### ws:connected

> **ws:connected**: `object`

Defined in: packages/client/src/types/events.ts:85

---

### ws:connecting

> **ws:connecting**: `object`

Defined in: packages/client/src/types/events.ts:84

---

### ws:disconnected

> **ws:disconnected**: `object`

Defined in: packages/client/src/types/events.ts:87

#### topics

> **topics**: readonly `string`[]

---

### ws:subscribed

> **ws:subscribed**: `object`

Defined in: packages/client/src/types/events.ts:86

#### topics

> **topics**: readonly `string`[]

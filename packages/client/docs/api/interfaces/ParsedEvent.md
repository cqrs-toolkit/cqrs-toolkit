[**@cqrs-toolkit/client**](../README.md)

---

[@cqrs-toolkit/client](../globals.md) / ParsedEvent

# Interface: ParsedEvent

## Properties

### cacheKey

> **cacheKey**: `string`

---

### commandId?

> `optional` **commandId**: `string`

---

### data

> **data**: `unknown`

---

### entityRefInjection?

> `optional` **entityRefInjection**: `EntityRefInjection`

EntityRef injection metadata for anticipated creates. Present only for anticipated events.

---

### id

> **id**: `string`

---

### persistence

> **persistence**: [`EventPersistence`](../type-aliases/EventPersistence.md)

---

### position?

> `optional` **position**: `bigint`

---

### revision?

> `optional` **revision**: `bigint`

---

### streamId

> **streamId**: `string`

---

### type

> **type**: `string`

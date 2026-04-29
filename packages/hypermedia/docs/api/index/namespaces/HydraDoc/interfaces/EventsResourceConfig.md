[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / EventsResourceConfig

# Interface: EventsResourceConfig

## Properties

### description?

> `optional` **description**: `string`

Human-readable description for this events GET endpoint.

---

### id

> **id**: `string`

Template node `@id` (fragment or URN) for this events surface.

---

### operationId?

> `optional` **operationId**: `string`

OpenAPI `operationId` for this events GET endpoint.

---

### profile

> **profile**: `string`

Profile IRI/URN for the surface.

---

### responses?

> `optional` **responses**: readonly [`ResponseEntry`](../type-aliases/ResponseEntry.md)[]

Response entries (status codes + schemas) for this events GET endpoint.

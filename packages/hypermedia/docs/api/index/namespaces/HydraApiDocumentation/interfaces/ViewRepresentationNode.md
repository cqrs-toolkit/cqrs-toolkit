[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraApiDocumentation](../README.md) / ViewRepresentationNode

# Interface: ViewRepresentationNode

## Properties

### @id

> **@id**: `string`

---

### @type

> **@type**: `"svc:ViewRepresentation"`

---

### rdf:type?

> `optional` **rdf:type**: `string`[]

e.g. `['svc:Deprecated']`.

---

### schema:version

> **schema:version**: `string`

---

### svc:base

> **svc:base**: `object`

`@id` of the base [Representation](Representation.md) (i.e. [Representation](Representation.md)'s `@id`).

#### @id

> **@id**: `string`

---

### svc:collection

> **svc:collection**: [`QuerySurface`](QuerySurface.md)

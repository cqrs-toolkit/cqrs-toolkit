[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraApiDocumentation](../README.md) / OperationLinkNode

# Interface: OperationLinkNode

## Properties

### @id

> **@id**: `string`

---

### @type

> **@type**: `"svc:OperationLink"`

---

### rdf:type?

> `optional` **rdf:type**: `string`[]

e.g. `['svc:Deprecated']`.

---

### schema:version

> **schema:version**: `string`

---

### svc:surface

> **svc:surface**: [`QuerySurface`](QuerySurface.md)

Single templated operation surface (no required query expansion).

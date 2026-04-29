[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / SupportedProperty

# Interface: SupportedProperty

## Properties

### description?

> `optional` **description**: `string`

Human-readable description of the property.

---

### links

> **links**: readonly \[[`SupportedPropertyTarget`](../type-aliases/SupportedPropertyTarget.md), [`SupportedPropertyTarget`](../type-aliases/SupportedPropertyTarget.md)\]

Versioned link targets — either [ViewRepresentation](../classes/ViewRepresentation.md) (collection-style
scoped sub-resource) or [OperationLink](../classes/OperationLink.md) (single-resource templated
operation, e.g. download redirect). All entries within one `links` array
must share the same [ViewRepresentation.kind](../classes/ViewRepresentation.md#kind) / [OperationLink.kind](../classes/OperationLink.md#kind).

Mirrors the versioning semantics of [ClassDef.representations](ClassDef.md#representations): as base
resources evolve, append additional entries each binding to its own base
version. Ids and SemVer must be unique within this array.

Typed as a non-empty tuple so the compiler rejects `links: []`.

---

### property

> **property**: `string`

rdf:Property IRI for this link, e.g. 'chat:fileObjects'.

[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HAL](../README.md) / ResourceDefinition

# Interface: ResourceDefinition

## Properties

### children?

> `optional` **children**: [`ChildCollectionDefinition`](ChildCollectionDefinition.md)[]

Child collections (to-many). Use this for lists you might embed as arrays and/or add collection links for.
For 1-to-1 related resources, use `embeddedResources` instead.

---

### class

> **class**: `string`

class IRI

---

### collectionLink?

> `optional` **collectionLink**: `object`

link back to parent collection

#### collection?

> `optional` **collection**: `boolean`

When true, render this rel as an array (even if there's only 1).

#### href

> **href**: `string`

#### rel?

> `optional` **rel**: `string`

#### templated?

> `optional` **templated**: `boolean`

---

### curiesBaseHref?

> `optional` **curiesBaseHref**: `string`

default `/rels/{prefix}/{rel}` if omitted

---

### embeddedResources?

> `optional` **embeddedResources**: [`EmbeddedResourceDefinition`](EmbeddedResourceDefinition.md)[]

One-to-one related resources to embed as plain objects on this resource.
Use this for parent/related metadata (not child collections).

- The rel defaults to prefix:kebab-case(localPart) derived from `class`, unless overridden by `embedRel`.
- If the descriptor provides an array for this relation, the first element is used.
- If the value is null/undefined (or an empty array), the embed is omitted.

---

### extraLinks?

> `optional` **extraLinks**: `object`[]

#### collection?

> `optional` **collection**: `boolean`

When true, render this rel as an array (even if there's only 1).

#### href

> **href**: `string`

#### rel

> **rel**: `string`

#### templated?

> `optional` **templated**: `boolean`

#### title?

> `optional` **title**: `string`

#### type?

> `optional` **type**: `string`

---

### idTemplate

> **idTemplate**: `string`

builds 'self' href

---

### linkDensity?

> `optional` **linkDensity**: `"omit"` \| `"lean"` \| `"full"`

Default value

---

### selfTypeTemplate?

> `optional` **selfTypeTemplate**: `string`

sets `type` on SELF link (e.g. '{contentType}')

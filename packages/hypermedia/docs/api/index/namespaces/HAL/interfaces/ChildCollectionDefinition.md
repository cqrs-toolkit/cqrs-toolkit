[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HAL](../README.md) / ChildCollectionDefinition

# Interface: ChildCollectionDefinition

## Properties

### class

> **class**: `string`

child class IRI, e.g. 'storage:Rendition'

---

### collectionLink?

> `optional` **collectionLink**: `object`

Configure a link for the child collection on the parent resource.
This affects \_links only (whether or not the child is embedded).

#### href

> **href**: `string`

#### resolveTokens?

> `optional` **resolveTokens**: `string`[]

Only these tokens will be resolved at the parent; others stay templated

#### templated?

> `optional` **templated**: `boolean`

---

### embed?

> `optional` **embed**: `object`

#### collection?

> `optional` **collection**: `boolean`

When true, render this rel as an array (even if there's only 1).

---

### rel?

> `optional` **rel**: `string`

HAL rel name to embed children under.
If omitted, formatter derives it from `class`
(prefix:kebabCase(localPart)).

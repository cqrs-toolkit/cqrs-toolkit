[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HAL](../README.md) / CollectionLink

# Interface: CollectionLink

Parent collection for this resource. Typically not templated.

## Properties

### href

> **href**: `string`

Target URI of the collection.

---

### profile?

> `optional` **profile**: `string`

Profile/constraints URI or URN for the collection representation.

---

### templated?

> `optional` **templated**: `true`

---

### type?

> `optional` **type**: `string`

Media type served at `href` (e.g., "application/hal+json").

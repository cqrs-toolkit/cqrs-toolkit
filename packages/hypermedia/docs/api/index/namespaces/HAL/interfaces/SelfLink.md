[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HAL](../README.md) / SelfLink

# Interface: SelfLink

Exact representation of THIS resource. Not templated.

## Properties

### href

> **href**: `string`

Target URI (absolute or relative).

---

### profile?

> `optional` **profile**: `string`

Profile/constraints URI or URN for this representation.

---

### type?

> `optional` **type**: `string`

Media type served at `href` (e.g., "application/hal+json").

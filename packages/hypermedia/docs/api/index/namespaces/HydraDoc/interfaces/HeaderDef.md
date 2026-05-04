[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / HeaderDef

# Interface: HeaderDef

## Extended by

- [`NamedHeaderDef`](NamedHeaderDef.md)

## Properties

### description?

> `optional` **description**: `string`

Human-readable description rendered in OpenAPI tooling.

---

### required?

> `optional` **required**: `boolean`

Marks the header required. Defaults to false on both request and response sides per
OpenAPI 3.1. Emitters write `required: true` only when set; `required: false` is never
emitted, matching the existing parameter emission style for diff stability.

---

### schema

> **schema**: `JSONSchema7`

JSON Schema for the header value (typically `{ type: 'string' }`, sometimes with format/enum).

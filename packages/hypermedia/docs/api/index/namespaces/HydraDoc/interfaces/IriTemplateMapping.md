[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / IriTemplateMapping

# Interface: IriTemplateMapping

## Properties

### description?

> `optional` **description**: `string`

Per-mapping description override. Takes precedence over the dictionary default.

---

### property

> **property**: `string`

---

### required?

> `optional` **required**: `boolean`

---

### schema?

> `optional` **schema**: `JSONSchema7`

Per-mapping schema override for OpenAPI parameter generation.
Takes precedence over the property registry default in OpenApiDocumentation.
Use for properties whose schema varies by context (e.g. svc:include with per-representation enum values).

---

### variable

> **variable**: `string`

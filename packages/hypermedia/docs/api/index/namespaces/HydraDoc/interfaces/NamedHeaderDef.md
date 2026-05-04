[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / NamedHeaderDef

# Interface: NamedHeaderDef

[HeaderDef](HeaderDef.md) carrying its own header name; used inline in [HeaderEntry](../type-aliases/HeaderEntry.md).

NOTE: `name` is a toolkit-internal field used to determine the OpenAPI map key (response
side) or the `parameters[].name` value (request side). It is never emitted as a property
on the response Header Object — the Header Object identifies headers by map key.

## Extends

- [`HeaderDef`](HeaderDef.md)

## Properties

### description?

> `optional` **description**: `string`

Human-readable description rendered in OpenAPI tooling.

#### Inherited from

[`HeaderDef`](HeaderDef.md).[`description`](HeaderDef.md#description)

---

### name

> **name**: `string`

Header name as it appears on the wire (e.g., `X-Tenant-Id`). Case-insensitive on the wire.

---

### required?

> `optional` **required**: `boolean`

Marks the header required. Defaults to false on both request and response sides per
OpenAPI 3.1. Emitters write `required: true` only when set; `required: false` is never
emitted, matching the existing parameter emission style for diff stability.

#### Inherited from

[`HeaderDef`](HeaderDef.md).[`required`](HeaderDef.md#required)

---

### schema

> **schema**: `JSONSchema7`

JSON Schema for the header value (typically `{ type: 'string' }`, sometimes with format/enum).

#### Inherited from

[`HeaderDef`](HeaderDef.md).[`schema`](HeaderDef.md#schema)

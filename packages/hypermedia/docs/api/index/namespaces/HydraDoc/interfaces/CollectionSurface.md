[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / CollectionSurface

# Interface: CollectionSurface

OpenAPI operation metadata shared by all surfaces (command and query).

## Extends

- [`PlainQuerySurface`](PlainQuerySurface.md)

## Properties

### description?

> `optional` **description**: `string`

Human-readable description of this operation.

#### Inherited from

[`PlainQuerySurface`](PlainQuerySurface.md).[`description`](PlainQuerySurface.md#description)

---

### formats

> **formats**: readonly `string`[]

Media types the server can PRODUCE for this surface.
Example: ['application/json','application/hal+json']

#### Inherited from

[`PlainQuerySurface`](PlainQuerySurface.md).[`formats`](PlainQuerySurface.md#formats)

---

### href

> **href**: `` `/${string}` ``

Non-templated, canonical IRI for this surface.
Derived if omitted.

- For a collection: "/api/foo"
- For a resource-by-id you must still include any path tokens (e.g. "/api/foo/{id}"),
  but do NOT include query parameters here.

---

### operationId?

> `optional` **operationId**: `string`

OpenAPI operationId. Required for OpenAPI generation.

#### Inherited from

[`PlainQuerySurface`](PlainQuerySurface.md).[`operationId`](PlainQuerySurface.md#operationid)

---

### profile

> **profile**: `string`

Profile identifier (IRI/URN) for this surface's wire contract.
Example: 'urn:profile:storage.FileObject:1.0.0'

#### Inherited from

[`PlainQuerySurface`](PlainQuerySurface.md).[`profile`](PlainQuerySurface.md#profile)

---

### responses?

> `optional` **responses**: readonly [`ResponseEntry`](../type-aliases/ResponseEntry.md)[]

Response documentation for this operation.

#### Inherited from

[`PlainQuerySurface`](PlainQuerySurface.md).[`responses`](PlainQuerySurface.md#responses)

---

### responseSchemaUrn?

> `optional` **responseSchemaUrn**: `string`

URN for the oneOf union schema when 2xx responses have different schemas per contentType.

#### Inherited from

[`PlainQuerySurface`](PlainQuerySurface.md).[`responseSchemaUrn`](PlainQuerySurface.md#responseschemaurn)

---

### template

> **template**: [`PlainIriTemplate`](PlainIriTemplate.md)

IRI template describing how to fetch this surface.
Format: RFC6570 query expansion with the supported variables.
Example: /api/storage/file-objects/{id}

- For a collection, this is typically the SEARCH template (query params).
- For a resource, include to document all id parameters.

#### Inherited from

[`PlainQuerySurface`](PlainQuerySurface.md).[`template`](PlainQuerySurface.md#template)

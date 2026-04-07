[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / PlainQuerySurface

# Interface: PlainQuerySurface

OpenAPI operation metadata shared by all surfaces (command and query).

## Extends

- [`OperationDocumentation`](OperationDocumentation.md)

## Extended by

- [`ResourceSurface`](ResourceSurface.md)
- [`CollectionSurface`](CollectionSurface.md)

## Properties

### description?

> `optional` **description**: `string`

Human-readable description of this operation.

#### Inherited from

[`OperationDocumentation`](OperationDocumentation.md).[`description`](OperationDocumentation.md#description)

---

### formats

> **formats**: readonly `string`[]

Media types the server can PRODUCE for this surface.
Example: ['application/json','application/hal+json']

---

### operationId?

> `optional` **operationId**: `string`

OpenAPI operationId. Required for OpenAPI generation.

#### Inherited from

[`OperationDocumentation`](OperationDocumentation.md).[`operationId`](OperationDocumentation.md#operationid)

---

### profile

> **profile**: `string`

Profile identifier (IRI/URN) for this surface's wire contract.
Example: 'urn:profile:storage.FileObject:1.0.0'

---

### responses?

> `optional` **responses**: readonly [`ResponseEntry`](../type-aliases/ResponseEntry.md)[]

Response documentation for this operation.

#### Inherited from

[`OperationDocumentation`](OperationDocumentation.md).[`responses`](OperationDocumentation.md#responses)

---

### responseSchemaUrn?

> `optional` **responseSchemaUrn**: `string`

URN for the oneOf union schema when 2xx responses have different schemas per contentType.

#### Inherited from

[`OperationDocumentation`](OperationDocumentation.md).[`responseSchemaUrn`](OperationDocumentation.md#responseschemaurn)

---

### template

> **template**: [`PlainIriTemplate`](PlainIriTemplate.md)

IRI template describing how to fetch this surface.
Format: RFC6570 query expansion with the supported variables.
Example: /api/storage/file-objects/{id}

- For a collection, this is typically the SEARCH template (query params).
- For a resource, include to document all id parameters.

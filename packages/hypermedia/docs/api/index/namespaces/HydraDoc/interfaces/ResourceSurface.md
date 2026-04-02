[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / ResourceSurface

# Interface: ResourceSurface

## Extends

- [`PlainQuerySurface`](PlainQuerySurface.md)

## Properties

### formats

> **formats**: readonly `string`[]

Media types the server can PRODUCE for this surface.
Example: ['application/json','application/hal+json']

#### Inherited from

[`PlainQuerySurface`](PlainQuerySurface.md).[`formats`](PlainQuerySurface.md#formats)

---

### href?

> `optional` **href**: `` `/${string}` ``

Non-templated, canonical IRI for this surface.
Derived if omitted.

- For a collection: "/api/foo"
- For a resource-by-id you must still include any path tokens (e.g. "/api/foo/{id}"),
  but do NOT include query parameters here.

---

### profile

> **profile**: `string`

Profile identifier (IRI/URN) for this surface's wire contract.
Example: 'urn:profile:storage.FileObject:1.0.0'

#### Inherited from

[`PlainQuerySurface`](PlainQuerySurface.md).[`profile`](PlainQuerySurface.md#profile)

---

### responseSchema?

> `optional` **responseSchema**: readonly [`ContentTypeSchema`](ContentTypeSchema.md)[]

Per-content-type response schemas for this surface.

#### Inherited from

[`PlainQuerySurface`](PlainQuerySurface.md).[`responseSchema`](PlainQuerySurface.md#responseschema)

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

[**@cqrs-toolkit/hypermedia**](../../../../README.md)

---

[@cqrs-toolkit/hypermedia](../../../../modules.md) / [index](../../../README.md) / [HydraDoc](../README.md) / PlainQuerySurface

# Interface: PlainQuerySurface

## Extended by

- [`ResourceSurface`](ResourceSurface.md)
- [`CollectionSurface`](CollectionSurface.md)

## Properties

### formats

> **formats**: readonly `string`[]

Media types the server can PRODUCE for this surface.
Example: ['application/json','application/hal+json']

---

### profile

> **profile**: `string`

Profile identifier (IRI/URN) for this surface's wire contract.
Example: 'urn:profile:storage.FileObject:1.0.0'

---

### template

> **template**: [`PlainIriTemplate`](PlainIriTemplate.md)

IRI template describing how to fetch this surface.
Format: RFC6570 query expansion with the supported variables.
Example: /api/storage/file-objects/{id}

- For a collection, this is typically the SEARCH template (query params).
- For a resource, include to document all id parameters.

[**@cqrs-toolkit/hypermedia-client**](../README.md)

---

[@cqrs-toolkit/hypermedia-client](../README.md) / SurfaceEndpoint

# Interface: SurfaceEndpoint

A single surface endpoint (collection, resource, or events).

## Properties

### href?

> `optional` **href**: `string`

Non-templated base href (e.g. '/api/todos')

---

### template

> **template**: `string`

RFC 6570 URI template (e.g. '/api/todos/{id}/events{?afterRevision}')
